import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Typography, 
  Breadcrumb, 
  Spin, 
  Divider, 
  message, 
  Result,
  Tabs 
} from 'antd';
import { HomeOutlined, FileExcelOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { fetchExcelDetails, loadExcelData, getSheetData } from '../services/api';
import VisualizationPanel from '../components/VisualizationPanel';
import MarkdownDisplay from '../components/MarkdownDisplay';
import './ExcelDetail.css';

const { Title } = Typography;
const { TabPane } = Tabs;

const ExcelDetail = () => {
  const { id } = useParams(); // Excel文件名或ID
  const [excelData, setExcelData] = useState(null);
  const [sheetsData, setSheetsData] = useState(null);
  const [description, setDescription] = useState('');
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('1');
  const decodedId = decodeURIComponent(id);

  useEffect(() => {
    const loadExcelDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // 获取Excel分析描述
        const descriptionResponse = await fetchExcelDetails(decodedId);
        if (descriptionResponse && descriptionResponse.success) {
          setDescription(descriptionResponse.description || '');
        } else {
          console.error('获取Excel分析描述失败:', descriptionResponse?.error);
          message.error('获取Excel分析描述失败');
        }

        // 加载Excel数据
        const dataResponse = await loadExcelData(decodedId);
        if (dataResponse && dataResponse.success) {
          setSheets(dataResponse.sheets || []);
          setExcelData(dataResponse);
        } else {
          setError('加载Excel数据失败');
          console.error('加载Excel数据失败:', dataResponse?.error);
        }
        
        // 获取完整的sheet数据供可视化使用
        const sheetsResponse = await getSheetData(decodedId);
        if (sheetsResponse && sheetsResponse.success) {
          setSheetsData(sheetsResponse.data || {});
        } else {
          console.error('获取Sheet数据失败:', sheetsResponse?.error);
        }
      } catch (error) {
        console.error('获取Excel详情出错:', error);
        setError('获取Excel详情失败');
        message.error('获取Excel详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (decodedId) {
      loadExcelDetails();
    }
  }, [decodedId]);

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" tip="加载Excel数据和分析结果..." />
      </div>
    );
  }

  // 如果发生错误，显示错误信息
  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={
          <Link to="/excel">返回Excel列表</Link>
        }
      />
    );
  }

  return (
    <div className="excel-detail-container">
      <Breadcrumb className="breadcrumb">
        <Breadcrumb.Item>
          <Link to="/excel">
            <HomeOutlined /> 首页
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <FileExcelOutlined /> {decodedId}
        </Breadcrumb.Item>
      </Breadcrumb>

      <Title level={2} className="excel-title">
        {decodedId}
      </Title>

      <Divider />

      <Tabs 
        defaultActiveKey="1" 
        activeKey={activeTab}
        onChange={handleTabChange}
        animated={true}
        className="excel-detail-tabs"
      >
        <TabPane 
          tab={<span><FileTextOutlined />数据分析内容</span>} 
          key="1"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={24}>
              <MarkdownDisplay markdownContent={description} />
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={<span><BarChartOutlined />可视化分析面板</span>} 
          key="2"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24}>
              {sheetsData ? (
                <VisualizationPanel 
                  sheetsData={sheetsData} 
                  reportName={decodedId}
                />
              ) : (
                <div className="no-sheets">
                  <Result 
                    status="info" 
                    title="暂无数据"
                    subTitle="该Excel文件没有可用的工作表数据" 
                  />
                </div>
              )}
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ExcelDetail; 