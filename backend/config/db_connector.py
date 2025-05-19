import mysql.connector
from mysql.connector import Error
import logging
from typing import Optional, Dict, Any
import os


class DBConnector:
    """
    通用的数据库连接器，用于管理数据库连接和执行操作
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化数据库连接器
        
        参数:
            config: 数据库配置，包含host, port, user, password, database, charset等信息
        """
        self.config = config
        self.connection = None
        self.logger = logging.getLogger(__name__)
        self._connect()
    
    def _connect(self):
        """建立数据库连接"""
        try:
            self.connection = mysql.connector.connect(
                host=self.config["host"],
                port=self.config["port"],
                user=self.config["user"],
                password=self.config["password"],
                database=self.config["database"],
                charset=self.config["charset"]
            )
            self.logger.info("数据库连接成功")
        except Error as e:
            self.logger.error(f"数据库连接失败: {e}")
            self.connection = None
    
    def _reconnect_if_needed(self):
        """检查连接状态并在需要时重新连接"""
        try:
            if self.connection is None or not self.connection.is_connected():
                self.logger.info("重新连接数据库")
                self._connect()
        except Exception as e:
            self.logger.error(f"重新连接数据库失败: {e}")
    
    def close(self):
        """关闭数据库连接"""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            self.logger.info("数据库连接已关闭")
    
    def execute_query(self, query: str, params: tuple = None) -> Optional[list]:
        """
        执行查询并返回结果
        
        参数:
            query: SQL查询语句
            params: 查询参数
            
        返回:
            查询结果列表，如果失败则返回None
        """
        self._reconnect_if_needed()
        if not self.connection:
            self.logger.warning("数据库未连接")
            return None
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params or ())
            result = cursor.fetchall()
            cursor.close()
            return result
        except Exception as e:
            self.logger.error(f"执行查询失败: {str(e)}")
            return None
    
    def execute_update(self, query: str, params: tuple = None) -> bool:
        """
        执行更新操作（INSERT, UPDATE, DELETE等）
        
        参数:
            query: SQL更新语句
            params: 更新参数
            
        返回:
            操作是否成功
        """
        self._reconnect_if_needed()
        if not self.connection:
            self.logger.warning("数据库未连接")
            return False
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params or ())
            self.connection.commit()
            affected_rows = cursor.rowcount
            cursor.close()
            self.logger.info(f"执行更新成功，影响行数: {affected_rows}")
            return True
        except Exception as e:
            self.logger.error(f"执行更新失败: {str(e)}")
            return False 