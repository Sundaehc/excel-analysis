import os
import glob
import datetime
import sys
from apscheduler.schedulers.blocking import BlockingScheduler
import logging 
logger = logging.getLogger(__name__)


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from analytics.ai_analysis import ai_analysis
from config.general_config import APP_CONFIG

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER")
def test():
    logger.info("开始执行定时任务")
    remote_dir = UPLOAD_FOLDER
    
    try:
        excel_files = glob.glob(os.path.join(remote_dir, "*.xlsx"))
        if not excel_files:
            logger.warning("未找到Excel文件，请检查目录路径")
            return
        
        for file_path in excel_files:
            file_name = os.path.basename(file_path)
            logger.info(f"分析文件: {file_name}")
            
            result = ai_analysis(file_path, save_to_db=True)
            
            if not result["success"]:
                logger.error(f"分析失败: {result['error']}")
    except Exception as e:
        logger.error(f"定时任务执行失败: {str(e)}")



# 启动定时器
if __name__ == "__main__":
    test()