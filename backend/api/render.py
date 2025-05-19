from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
import os
import dotenv
import sys
import logging
from flask_cors import CORS
from io import BytesIO
from pyecharts import options as opts
from pyecharts.charts import Bar
from pyecharts.components import Table
from pyecharts.globals import ThemeType

app = Flask(__name__)
CORS(app)
dotenv.load_dotenv()
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.general_config import DB_CONFIG
from minio import Minio
from config.db_connector import DBConnector
# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() == "true"

# 数据加载函数
def load_data(report_name: str):
         # 读取Minio中的Excel的所有工作表
        logger.info(f"开始读取excel中的所有sheet")
        try:
             minio_client = Minio(
                 MINIO_ENDPOINT,
                 access_key=MINIO_ACCESS_KEY,
                 secret_key=MINIO_SECRET_KEY,
                 secure=MINIO_SECURE
            )
        except Exception as e:
            logger.error(f"Minio客户端初始化失败: {str(e)}")
            return None, f"Minio客户端初始化失败: {str(e)}"
        
        try:
            response = minio_client.get_object(MINIO_BUCKET, report_name)
            data = response.read()
            excel_file = BytesIO(data)
            
            # 使用ExcelFile获取sheets列表
            xls = pd.ExcelFile(excel_file)
            all_sheets = xls.sheet_names
            logger.info(f"Excel文件中的工作表: {all_sheets}")
            
            # 读取所有工作表
            sheets = {}
            for sheet_name in all_sheets:
                try:
                    # 使用ExcelFile对象读取每个工作表
                    sheets[sheet_name] = xls.parse(sheet_name)
                    logger.info(f"成功加载工作表: {sheet_name}")
                except Exception as e:
                    logger.error(f"加载工作表 {sheet_name} 失败: {str(e)}")
                    continue
        except Exception as e:
            logger.error(f"从MinIO获取文件失败: {str(e)}")
            return None, f"从MinIO获取文件失败: {str(e)}"
        
        # 对每个数据框进行基本处理
        processed_sheets = {}  # 创建一个新字典来存储处理过的数据框
        for sheet_name, df in list(sheets.items()):  # 转换为列表避免迭代过程中修改字典
            # 填充缺失值
            processed_df = df.fillna(0)
            processed_sheets[sheet_name] = processed_df
            
            # 按现期和基期时间划分数据
            if "时间" in df.columns:
                # 分别提取现期和基期数据
                current_period_df = df[df["时间"] == "现期"].copy()
                base_period_df = df[df["时间"] == "基期"].copy()
                
                # 将两个期间的数据存储到字典中
                if not current_period_df.empty:
                    processed_sheets[sheet_name] = current_period_df.fillna(0)
                
                # 添加基期数据，使用"{sheet_name}_基期"作为键
                if not base_period_df.empty:
                    processed_sheets[f"{sheet_name}_基期"] = base_period_df.fillna(0)
        
        # 用处理过的字典替换原来的字典
        sheets = processed_sheets
        
        logger.info(f"成功加载所有工作表，共 {len(sheets)} 个工作表")
        logger.info(f"工作表列表: {list(sheets.keys())}")
        
        return sheets, None

# 图表创建函数
def create_bar_chart(df, x_col, y_col, title=None, is_percentage=False, orientation="v"):
    """创建柱状图"""
    # 处理数据
    df_chart = df.copy()
    
    # 检查是否为货值或销售相关图表，转换为万元单位
    is_value_chart = '货值' in y_col or '销售' in y_col
    unit_text = ""
    
    if is_value_chart and not is_percentage:
        # 转换为万元
        df_chart[y_col] = df_chart[y_col] / 10000
        unit_text = "(万元)"
    
    # 创建柱状图
    chart = Bar(init_opts=opts.InitOpts(width="100%", height="400px", theme=ThemeType.LIGHT))
    
    # 设置图表数据
    if orientation == "h":
        # 水平方向
        chart.add_xaxis(df_chart[y_col].tolist())
        chart.add_yaxis("", df_chart[x_col].tolist())
    else:
        # 垂直方向
        chart.add_xaxis(df_chart[x_col].tolist())
        chart.add_yaxis("", df_chart[y_col].tolist())
    
    # 添加单位到标题
    if title and is_value_chart and not is_percentage:
        title = f"{title}{unit_text}"
    
    # 设置标题和样式
    chart.set_global_opts(
        title_opts=opts.TitleOpts(title=title),
        toolbox_opts=opts.ToolboxOpts(),
        tooltip_opts=opts.TooltipOpts(trigger="axis"),
        datazoom_opts=[opts.DataZoomOpts()],
    )
    
    # 为环比和占比添加百分比格式化
    if is_percentage:
        chart.set_series_opts(
            label_opts=opts.LabelOpts(formatter="{c}%", position="top"),
        )
    else:
        # 为货值和销售额图表添加单位提示
        if is_value_chart:
            chart.set_series_opts(
                label_opts=opts.LabelOpts(formatter="{c} 万元", position="top"),
            )
        else:
            chart.set_series_opts(
                label_opts=opts.LabelOpts(formatter="{c}", position="top"),
            )
    
    return chart

# 处理分类标签页数据
def process_category_data(df, category_col, sheet_name=None):
    """处理分类数据，返回图表和指标"""
    try:
        # 获取唯一分类值
        categories = df[category_col].unique()
        
        # 检查是否为货盘概况的特殊情况
        is_huopan = (sheet_name == "货盘概况" and category_col == "是否动销")
        
        # 只保留主分类（过滤掉"是"/"否"等子分类），但货盘概况要保留"是"和"否"
        if is_huopan:
            # 货盘概况特殊处理，保留"是"和"否"
            main_categories = categories
            logger.info(f"货盘概况特殊处理，保留所有分类值: {main_categories}")
        else:
            # 其他情况，过滤掉"是"和"否"
            main_categories = [cat for cat in categories if not (cat == "是" or cat == "否")]
        
        # 过滤数据
        df_main = df[df[category_col].isin(main_categories)]
        
        # 检查总计行是否已存在
        has_total_row = False
        total_row_index = None
        
        # 查找是否有名为"总计"的行
        if category_col in df.columns:
            total_rows = df[df[category_col] == "总计"]
            if not total_rows.empty:
                has_total_row = True
                total_row_index = total_rows.index[0]
                logger.info(f"检测到总计行: {total_rows.iloc[0].to_dict()}")
        
        # 计算主要指标总和 - 避免重复计算
        if has_total_row:
            # 使用已有的总计行数据
            total_row = df.loc[total_row_index]
            logger.info(f"使用已有总计行: {total_row.to_dict()}")
            
            # 将货值和销售额转换为万元单位
            total_value = float(total_row["上周货值"] if "上周货值" in total_row else 0) / 10000
            total_sales = float(total_row["上周销售"] if "上周销售" in total_row else 0) / 10000
            
            metrics = {
                "total_goods": int(total_row["上周货号数"] if "上周货号数" in total_row else 0),
                "total_value": total_value,  # 已转换为万元单位
                "total_inventory": int(total_row["库存数"] if "库存数" in total_row else 0),
                "total_sales": total_sales  # 已转换为万元单位
            }
        else:
            # 计算除总计行外的所有数据总和
            df_no_total = df[df[category_col] != "总计"]
            
            # 将货值和销售额转换为万元单位
            total_value = float(df_no_total["上周货值"].sum() if "上周货值" in df_no_total.columns else 0) / 10000
            total_sales = float(df_no_total["上周销售"].sum() if "上周销售" in df_no_total.columns else 0) / 10000
            
            metrics = {
                "total_goods": int(df_no_total["上周货号数"].sum() if "上周货号数" in df_no_total.columns else 0),
                "total_value": total_value,  # 已转换为万元单位
                "total_inventory": int(df_no_total["库存数"].sum() if "库存数" in df_no_total.columns else 0),
                "total_sales": total_sales  # 已转换为万元单位
            }
            
            logger.info(f"计算得到的总计: {metrics}")
    
        
        return {
            "metrics": metrics,
            "data": df.to_dict(orient="records"),
            "category_col": category_col  # 添加分类列信息
        }
    except Exception as e:
        logger.error(f"处理分类数据出错: {str(e)}")
        return {
            "metrics": {"total_goods": 0, "total_value": 0, "total_inventory": 0, "total_sales": 0},
            "charts": {},
            "data": [],
            "category_col": category_col
        }

# 路由：加载数据
@app.route('/load_data')
def api_load_data():
    report_name = request.args.get('report_name')
    if not report_name:
        return jsonify({"success": False, "error": "缺少report_name参数"})
    
    data, error = load_data(report_name)
    logger.info(f"加载数据: {data}")
    if error:
        return jsonify({"success": False, "error": error})
    return jsonify({"success": True, "sheets": list(data.keys())})

# 新增：获取完整sheet数据供可视化使用
@app.route('/get_sheet_data')
def api_get_sheet_data():
    report_name = request.args.get('report_name')
    if not report_name:
        return jsonify({"success": False, "error": "缺少report_name参数"})
    
    data, error = load_data(report_name)
    if error:
        return jsonify({"success": False, "error": error})
    
    # 将DataFrame转为字典
    sheets_data = {}
    for sheet_name, df in data.items():
        sheets_data[sheet_name] = df.to_dict(orient='records')   

    return jsonify({
        "success": True, 
        "data": sheets_data
    })

# 路由：获取分类数据
@app.route('/category/<category>')
def api_category(category):
    try:
        report_name = request.args.get('report_name')
        if not report_name:
            return jsonify({"success": False, "error": "缺少report_name参数"})
            
        data, error = load_data(report_name)
        if error:
            return jsonify({"success": False, "error": error})
        
        if category not in data:
            logger.error(f"请求的分类 {category} 不存在")
            return jsonify({"success": False, "error": "分类不存在"})
        
        # 获取当前工作表的分类列
        category_column = get_category_column(category)
        
        category_data = process_category_data(data[category], category_column, sheet_name=category)
        
        # 确保返回给前端的是可序列化的数据
        safe_metrics = {}
        for key, value in category_data["metrics"].items():
            if isinstance(value, (int, float)):
                safe_metrics[key] = value
            else:
                safe_metrics[key] = 0
        
        # 处理数据框为可序列化格式
        safe_data = []
        for item in category_data["data"]:
            safe_item = {}
            for k, v in item.items():
                if isinstance(v, (str, int, float, bool)) and not pd.isna(v):
                    safe_item[k] = v
                elif pd.isna(v):
                    safe_item[k] = None
                else:
                    safe_item[k] = str(v)
            safe_data.append(safe_item)
        
        logger.info(f"成功处理分类 {category} 的数据，使用分类列: {category_column}")
        return jsonify({
            "success": True,
            "metrics": safe_metrics,
            "data": safe_data,
            "category_col": category_data.get("category_col", category_column)
        })
    except Exception as e:
        logger.error(f"处理分类 {category} 数据时出错: {str(e)}")
        return jsonify({"success": False, "error": f"处理分类数据失败: {str(e)}"})

# 根据工作表名获取对应的分类列
def get_category_column(sheet_name):
    """根据工作表名称返回对应的分类列名称"""
    
    category_mapping = {
        "是否动销": "价格段",
        "季节": "是否动销",
        "活动栏目": "资源分布",
        "货盘概况": "是否动销"
    }
    
    # 如果是特殊工作表，返回映射的分类列名
    if sheet_name in category_mapping:
        return category_mapping[sheet_name]
    
    # 对于其他工作表，默认使用工作表名作为分类列
    return sheet_name

# 路由：获取图表数据
@app.route('/chart/<category>/<chart_type>/<sub_type>')
def api_chart(category, chart_type, sub_type):
    try:
        report_name = request.args.get('report_name')
        if not report_name:
            return jsonify({"success": False, "error": "缺少report_name参数"})
            
        data, error = load_data(report_name)
        if error:
            return jsonify({"success": False, "error": error})
        
        if category not in data:
            return jsonify({"success": False, "error": "分类不存在"})
        
        # 获取当前工作表的分类列
        category_column = get_category_column(category)
        
        category_data = process_category_data(data[category], category_column, sheet_name=category)
        
        if chart_type not in category_data["charts"] or sub_type not in category_data["charts"][chart_type]:
            return jsonify({"success": False, "error": "图表类型不存在"})
        
        chart = category_data["charts"][chart_type][sub_type]
        if chart is None:
            return jsonify({"success": False, "error": "数据不可用"})
        
        # 返回图表选项，用于Echarts渲染 
        options_str = chart.dump_options()
        options_dict = json.loads(options_str)
        
        # 添加分类列信息到响应
        return jsonify({
            **options_dict,
            "category_col": category_column
        })
    except Exception as e:
        logger.error(f"获取图表数据出错: {str(e)}")
        return jsonify({"success": False, "error": f"获取图表数据失败: {str(e)}"})
    
# 获取所有信息
@app.route('/get/report', methods=['GET'])
def api_get_report():
    try:
        db_connector = DBConnector(DB_CONFIG["mysql"])
        db_connector._reconnect_if_needed()
        
        if not db_connector.connection:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        cursor = db_connector.connection.cursor(dictionary=True)
        # 执行查询
        query = "SELECT id,report_name, create_time FROM ai_analysis WHERE report_name IS NOT NULL"
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        db_connector.close()
        
        return jsonify({"success": True, "data": results})
    except Exception as e:
        logger.error(f"获取报告时出错: {str(e)}")
        return jsonify({"success": False, "error": f"获取报告失败: {str(e)}"})
    
# 获取报告名称
@app.route('/get/report/name', methods=['GET'])
def api_get_report_name():
    try:
        db_connector = DBConnector(DB_CONFIG["mysql"])
        db_connector._reconnect_if_needed()
        
        if not db_connector.connection:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        cursor = db_connector.connection.cursor(dictionary=True)
        # 执行查询
        query = "SELECT DISTINCT report_name FROM ai_analysis WHERE report_name IS NOT NULL"
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        db_connector.close()
        
        # 将结果转换为列表
        report_names = [row.get("report_name") for row in results if row.get("report_name")]
        
        return jsonify({"success": True, "report_names": report_names})
    except Exception as e:
        logger.error(f"获取报告名称时出错: {str(e)}")
        return jsonify({"success": False, "error": f"获取报告名称失败: {str(e)}"})

# 获取分析内容
@app.route('/get/report/description/<report_name>', methods=['GET'])
def api_get_analysis_content(report_name: str):
    try:
        db_connector = DBConnector(DB_CONFIG["mysql"])
        db_connector._reconnect_if_needed()
        if not db_connector.connection:
            return jsonify({"success": False, "error": "数据库连接失败"}), 500
        cursor = db_connector.connection.cursor(dictionary=True)
        # 执行查询
        query = "SELECT ai_description FROM ai_analysis WHERE report_name = %s"
        cursor.execute(query, (report_name,))
        result = cursor.fetchall()
        cursor.close()
        db_connector.close()
        
        if not result:
            return jsonify({"success": False, "error": "报告不存在"})
        
        # 修复：正确处理fetchall返回的结果列表，获取第一个结果的ai_description字段
        return jsonify({"success": True, "description": result[0].get("ai_description")})
    except Exception as e:
        logger.error(f"获取报告描述失败: {str(e)}")
        return jsonify({"success": False, "error": f"获取报告描述失败: {str(e)}"}), 500
    
    
if __name__ == '__main__':
    app.run(host='0.0.0.0',debug=True, port=5000) 