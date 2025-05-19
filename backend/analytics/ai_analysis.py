from ragflow_sdk import RAGFlow
from ragflow_sdk.modules.dataset import DataSet
import time
import os
import sys
from pathlib import Path
from typing import Dict, Union, Optional
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.general_config import DB_CONFIG, RAGFLOW_CONFIG, ANALYSIS_CONFIG, setup_logger
from minio import Minio
from config.db_connector import DBConnector



load_dotenv()

# 使用配置文件中的设置初始化日志
logger = setup_logger(__name__)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "excel-reports")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() == "true"
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
RAGFLOW_API_KEY = os.getenv("RAGFLOW_API_KEY")
# 初始化RAGFlow
rag_object = RAGFlow(
    api_key=os.getenv("RAGFLOW_API_KEY"), 
    base_url=RAGFLOW_CONFIG["base_url"]
)

# 创建解析器配置
parser_config = DataSet.ParserConfig(
    rag_object, 
    res_dict={"chunk_token_num": RAGFLOW_CONFIG["chunk_token_num"]}
)

# 数据集名称
dataset_name = RAGFLOW_CONFIG["dataset_name"]

# 保存Minio文件路径和分析内容到数据库
def save_data_to_db(report_name, ai_description, minio_report_path):
    try:
        # 创建数据库连接
        db_connector = DBConnector(DB_CONFIG["mysql"])
        db_connector._reconnect_if_needed()
        if not db_connector.connection:
            logger.error("数据库连接失败")
            return False
        logger.info("数据库连接成功")
        cursor = db_connector.connection.cursor()
        # 检查数据库中是否已经存在
        check_sql = "SELECT id FROM ai_analysis WHERE report_name = %s"
        cursor.execute(check_sql, (report_name,))
        existing_record = cursor.fetchone()
        
        if existing_record:
            # 如果存在更新数据
            update_sql = "UPDATE ai_analysis SET ai_description = %s, minio_report_path = %s, update_time=NOW() WHERE report_name = %s"
            cursor.execute(update_sql, (ai_description, minio_report_path, report_name))   
            db_connector.connection.commit()
            cursor.close()
            logger.info(f"更新已存在的记录: {report_name}")
            return True
        else:
            # 如果不存在就插入数据
            insert_sql = "INSERT INTO ai_analysis (report_name, ai_description, minio_report_path, create_time, update_time) VALUES (%s, %s, %s, NOW(), NOW())"
            cursor.execute(insert_sql, (report_name, ai_description, minio_report_path))
            db_connector.connection.commit()
            cursor.close()
            logger.info(f"插入新记录: {report_name}")
            return True
    except Exception as e:
        logger.error(f"保存到数据库时出错: {e}")
        return False
    

def ai_analysis(
    file_path: str = UPLOAD_FOLDER,
    question: Optional[str] = None,
    api_key: str = RAGFLOW_API_KEY,
    base_url: str = RAGFLOW_CONFIG["base_url"],
    dataset_name: str = RAGFLOW_CONFIG["dataset_name"],
    wait_for_parsing: bool = ANALYSIS_CONFIG["wait_for_parsing"],
    max_wait_time: int = ANALYSIS_CONFIG["max_wait_time"],
    save_to_db: bool = True
) -> Dict[str, Union[str, bool]]:
    """
    获取RAGFlow对报告的数据分析回答
    
    参数:
        file_path: 文件路径
        question: 提问内容，如果为None则根据文件类型自动选择问题
        api_key: RAGFlow API密钥
        base_url: RAGFlow服务基础URL
        dataset_name: 数据集名称
        wait_for_parsing: 是否等待文档解析完成
        max_wait_time: 最大等待时间(秒)
        save_to_db: 是否将结果保存到数据库
        
    返回:
        包含回答内容和状态的字典
    """
    result = {
        "success": False,
        "answer": "",
        "error": ""
    }
        
    try:
        # 初始化RAGFlow对象
        rag_object = RAGFlow(api_key=api_key, base_url=base_url)
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            result["error"] = f"文件不存在: {file_path}"
            return result
        
        # 创建解析器配置
        parser_config = DataSet.ParserConfig(
            rag_object, 
            res_dict={"chunk_token_num": RAGFLOW_CONFIG["chunk_token_num"]}
        )
        
        file_name = os.path.basename(file_path)
        
        # 如果没有提供问题，则根据文件名自动生成
        if question is None:
            # 解析文件名和扩展名
            file_extension = os.path.splitext(file_name)[1].lower()
            file_name_without_ext = os.path.splitext(file_name)[0]
            # 不同文件对应不同的提示词
            question = f"帮我分析{file_name_without_ext}数据生成一份详细报告"
        
        logger.info(f"处理文件: {file_name}, 将使用提问: {question}")
        
        # 创建或获取数据集
        try:
            # 先尝试获取同名数据集
            owned_datasets = rag_object.list_datasets()
            dataset_exists = False
            dataset = None
            
            # 检查是否存在同名数据集
            if owned_datasets:
                for ds in owned_datasets:
                    if hasattr(ds, 'name') and ds.name == dataset_name:
                        dataset_exists = True
                        dataset = ds
                        break
            
            # 如果不存在则创建新数据集
            if not dataset_exists:
                dataset = rag_object.create_dataset(
                    name=dataset_name,
                    avatar="",
                    description="周报数据集",
                    embedding_model=RAGFLOW_CONFIG["embedding_model"],
                    permission="me",
                    chunk_method="naive",
                    parser_config=parser_config
                )
            # 检查该文件是否已存在于数据集中
            existing_docs = dataset.list_documents(keywords=file_name)
            if not existing_docs:
                # 读取文件内容
                with open(file_path, "rb") as f:
                    file_content = f.read()
                    # 先上传一份到Minio，将Minio的文件路径保存到数据库
                    try:
                        minio_client = Minio(
                             MINIO_ENDPOINT,
                             access_key=MINIO_ACCESS_KEY,
                             secret_key=MINIO_SECRET_KEY,
                             secure=MINIO_SECURE
                        )
                         
                        # 确保存储桶存在
                        if not minio_client.bucket_exists(MINIO_BUCKET):
                            minio_client.make_bucket(MINIO_BUCKET)
                            logger.info(f"创建Minio存储桶: {MINIO_BUCKET}")

                            logger.info(f"Minio客户端初始化成功，连接到: {MINIO_ENDPOINT}")
                        
                        try:
                            minio_report_path = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{file_name}"
                            minio_client.fput_object(
                                MINIO_BUCKET, 
                                file_name, 
                                f"{UPLOAD_FOLDER}\\{file_name}",
                            )
                            logger.info(f"文件 {file_name} 已成功上传到 MinIO 路径: {minio_report_path}")
                        except Exception as upload_error:
                            logger.error(f"上传文件到Minio失败: {str(upload_error)}")
                            result["error"] = f"上传文件到Minio失败: {str(upload_error)}"
                            return result
                    except Exception as e:
                        logger.error(f"Minio客户端初始化失败: {str(e)}")
                        result["error"] = f"Minio客户端初始化失败: {str(e)}"
                        return result
                    # 上传文档
                    dataset.upload_documents([{"display_name": file_name, "blob": file_content}])
                
                # 获取上传的文档ID
                doc_list = dataset.list_documents(keywords=file_name)
                document_ids = [doc.id for doc in doc_list]
            else:
                document_ids = [doc.id for doc in existing_docs]
            
            if not document_ids:
                result["error"] = "未找到已上传的文档"
                return result
                
            # 检查文档是否已经解析过
            doc_status = dataset.list_documents(id=document_ids[0])
            
            if doc_status and len(doc_status) > 0:
                run_status = getattr(doc_status[0], 'run', None)
                if run_status != "DONE":
                    # 解析文档
                    dataset.async_parse_documents(document_ids)
                    
                    if wait_for_parsing:
                        # 等待解析完成
                        wait_interval = ANALYSIS_CONFIG["wait_interval"]
                        parsing_done = False
                        
                        for i in range(int(max_wait_time / wait_interval)):
                            # 检查解析状态
                            doc_status = dataset.list_documents(id=document_ids[0])
                            
                            if doc_status and len(doc_status) > 0:
                                run_status = getattr(doc_status[0], 'run', None)
                                logger.info(f"文档处理状态: {run_status}")
                                print(f"文档处理进度: {run_status} ({i+1}/{int(max_wait_time / wait_interval)})", flush=True)
                                
                                if run_status == "DONE":
                                    parsing_done = True
                                    msg = f"✅ 文档解析已完成! 开始生成分析报告..."
                                    logger.info(msg)
                                    break
                                elif run_status == "FAIL":
                                    result["error"] = f"文档解析错误: {run_status}"
                                    msg = f"❌ 文档解析失败! 将尝试继续处理..."
                                    logger.info(msg)
                                    return result
                                elif run_status == "CANCEL": 
                                    result["error"] = f"文档解析被取消: {run_status}"
                                    msg = f"⚠️ 文档解析被取消! 将尝试继续处理..."
                                    logger.info(msg)
                                    return result
                            time.sleep(wait_interval)
                        
                        if not parsing_done:
                            result["error"] = "文档解析超时，可能无法提供准确答案"
                            return result
            
            
            owned_assistants = rag_object.list_chats()
            assistant = None
            assistant_name = f"{file_name}"
            
            # 查找或创建助手
            for asst in owned_assistants:
                if hasattr(asst, 'name') and asst.name == assistant_name:
                    assistant = asst
                    logger.info(f"找到已存在的助手: {assistant_name}")
                    break
            
            if not assistant:
                logger.info(f"创建新助手: {assistant_name}")
                assistant = rag_object.create_chat(assistant_name, dataset_ids=[dataset.id])
                logger.info(f"创建助手成功")
            
            # 为每个文件创建独立的会话名称
            file_name_without_ext = os.path.splitext(file_name)[0]
            unique_session_name = f"数据分析_{file_name_without_ext}_{int(time.time())}"
            logger.info(f"创建新会话: {unique_session_name}")
            
            # 创建新会话
            session = assistant.create_session(unique_session_name)
            logger.info(f"创建会话成功")
            
            # 获取助手回答
            print(f"\n================ 正在生成 {file_name} 的分析报告 ================\n", flush=True)
            print(f"问题: {question}\n", flush=True)
            print("正在思考中...", flush=True)
            
            answer_content = ""
            try:
                # 流式输出回答
                cont = ""
                for ans in session.ask(question, stream=True):
                    new_content = ans.content[len(cont):]
                    print(new_content, end='', flush=True)
                    cont = ans.content
                
                # 保存完整回答
                answer_content = cont
                
                print("\n\n================ 分析报告生成完成 ================\n", flush=True)
                
                # 检查回答内容是否为空
                if not answer_content:
                    logger.warning("警告: 助手返回的回答内容为空")
                    result["error"] = "助手返回的回答内容为空"
                    return result
                
                # 将回答内容插入数据库
                if save_to_db:
                    try:
                        logger.info(f"开始保存{file_name}的分析结果到数据库")
                        db_success = save_data_to_db(file_name, answer_content, minio_report_path)
                        if db_success:
                            logger.info(f"{file_name}的分析结果已成功保存到数据库")
                            msg = f"✅ {file_name}的分析结果和Minio路径已成功保存到数据库"
                            logger.info(msg)
                        else:
                            logger.warning(f"无法保存{file_name}的分析结果和Minio路径到数据库")
                            msg = f"\n⚠️ 无法保存{file_name}的分析结果和Minio路径到数据库"
                            logger.info(msg)
                    except Exception as e:
                        logger.error(f"数据库操作失败: {str(e)}")
                        msg = f"❌ 数据库操作失败: {str(e)}"
                        logger.info(msg)
                
                # 设置成功结果
                result["answer"] = answer_content
                result["success"] = True
                return result
                
            except Exception as e:
                error_msg = f"获取助手回答失败: {str(e)}"
                logger.error(error_msg)
                msg = f"❌ {error_msg}"
                logger.info(msg)
                result["error"] = error_msg
                return result
            
        except Exception as e:
            result["error"] = f"处理数据集或会话时出错: {str(e)}"
            logger.error(f"处理数据集或会话时出错: {str(e)}")
            return result
            
    except Exception as e:
        result["error"] = f"访问或处理文件时出错: {str(e)}"
        logger.error(f"访问或处理文件时出错: {str(e)}")
        return result


def main():
    result = ai_analysis(file_path=UPLOAD_FOLDER, save_to_db=True)
    print(result)
    
if __name__ == "__main__":
    main()
