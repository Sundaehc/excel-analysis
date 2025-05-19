import React, { useState, useEffect } from 'react';
import { Row, Col, Typography, Input, Empty, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ExcelCard from '../components/ExcelCard';
import { fetchExcelFiles } from '../services/api';
import './ExcelList.css';

const { Title } = Typography;

const ExcelList = () => {
  const [excelFiles, setExcelFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const loadExcelFiles = async () => {
      try {
        const response = await fetchExcelFiles();
        if (response && response.success) {
          setExcelFiles(response.data || []);
          setFilteredFiles(response.data || []);
        } else {
          console.error('获取Excel文件列表失败:', response.error);
        }
      } catch (error) {
        console.error('加载Excel文件列表出错:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExcelFiles();
  }, []);

  // 搜索处理
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredFiles(excelFiles);
      return;
    }

    const filtered = excelFiles.filter(file => 
      file.report_name && file.report_name.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredFiles(filtered);
  }, [searchText, excelFiles]);

  return (
    <div className="excel-list-container">
      <div className="excel-list-header">
        <Title level={2}>Excel 数据分析平台</Title>
        <p className="subtitle">选择一个Excel文件进行可视化和数据分析</p>
        
        <Input
          className="search-input"
          placeholder="搜索Excel文件..."
          prefix={<SearchOutlined />}
          onChange={e => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" tip="加载Excel文件列表..." />
        </div>
      ) : filteredFiles.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredFiles.map(excel => (
            <Col xs={24} sm={12} md={8} lg={6} key={excel.id}>
              <ExcelCard excel={excel} />
            </Col>
          ))}
        </Row>
      ) : (
        <Empty 
          description="没有找到Excel文件" 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
        />
      )}
    </div>
  );
};

export default ExcelList; 