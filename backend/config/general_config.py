import os
import logging


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 数据库配置
DB_CONFIG = {
    "mysql": {
        "host": "localhost",
        "port": 3306,
        "user": "root",
        "password": "root",
        "database": "dataanalysis",
        "charset": "utf8mb4"
    }
}

# 程序信息配置
APP_CONFIG = {
    "version": "1.0.0",
    "name": "数据分析工具",
    "description": "自动分析数据并生成报告",
    "author": "sundae"
}

# 日志配置
LOG_CONFIG = {
    "level": logging.INFO,
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "file": os.path.join(BASE_DIR, "ragflow_analysis.log"),
    "console_level": logging.INFO,
    "file_level": logging.INFO
}

# RAGFlow 配置
RAGFLOW_CONFIG = {
    "base_url": "http://localhost",
    "dataset_name": "weekly_report",
    "chunk_token_num": 2048,
    "embedding_model": "embedding-3"
}

# 分析配置
ANALYSIS_CONFIG = {
    "wait_for_parsing": True,
    "max_wait_time": 300,  # 最大等待时间(秒)
    "wait_interval": 10,   # 轮询间隔(秒)
}

# 初始化日志
def setup_logger(name):
    """
    设置日志器
    """
    logger = logging.getLogger(name)
    logger.setLevel(LOG_CONFIG["level"])
    
    # 检查是否已有处理器，避免重复添加
    if not logger.handlers:
        # 创建控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(LOG_CONFIG["console_level"])

        # 创建文件处理器
        file_handler = logging.FileHandler(LOG_CONFIG["file"])
        file_handler.setLevel(LOG_CONFIG["file_level"])

        # 创建格式器
        formatter = logging.Formatter(LOG_CONFIG["format"])
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)

        # 添加处理器到logger
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
    
    return logger