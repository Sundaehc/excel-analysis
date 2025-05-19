import os
import sys
import json
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.general_config import DB_CONFIG
from config.db_connector import DBConnector

logger = logging.getLogger(__name__)

def api_get_report_name():
    try:
        db_connector = DBConnector(DB_CONFIG["mysql"])
        db_connector._reconnect_if_needed()
        
        if not db_connector.connection:
            return {"success": False, "error": "数据库连接失败"}, 500
        cursor = db_connector.connection.cursor(dictionary=True)
        # 执行查询
        query = "SELECT id, report_name, create_time FROM ai_analysis WHERE report_name IS NOT NULL"
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        db_connector.close()
        
        # # 将结果转换为列表
        # report_names = [row.get("report_name") for row in results if row.get("report_name")]
        
        logger.info(f"获取报告名称: {results}")
        return {"success": True, "data": results}
    except Exception as e:
        logger.error(f"获取报告名称时出错: {str(e)}")
        return {"success": False, "error": str(e)}, 500
    
if __name__ == "__main__":
    result = api_get_report_name()
    # 处理可能的元组返回值（错误状态码情况）
    if isinstance(result, tuple) and len(result) == 2:
        data, status_code = result
        print(f"状态码: {status_code}")
        print("数据:", data)
    else:
        print("成功:", result["success"])
        if result["success"]:
            print("报告列表:", result["data"])
        else:
            print("错误:", result.get("error", "未知错误"))
