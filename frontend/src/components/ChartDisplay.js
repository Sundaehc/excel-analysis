import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Spin, Row, Col, Radio, Tabs } from 'antd';
import { fetchChartData } from '../services/api';

const { TabPane } = Tabs;

const ChartDisplay = ({ category, sheets, reportName }) => {
  const [chartType, setChartType] = useState('sales');
  const [subType, setSubType] = useState('goods');
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);

  // 图表类型选项
  const chartTypes = [
    { label: '销售分析', value: 'sales' },
    { label: '环比分析', value: 'mom' },
    { label: '占比分析', value: 'proportion' }
  ];

  // 子类型选项
  const subTypes = [
    { label: '总货号数', value: 'goods' },
    { label: '总货值(万元)', value: 'value' },
    { label: '总库存数', value: 'inventory' },
    { label: '总销售额(万元)', value: 'sales' }
  ];

  useEffect(() => {
    const loadChartData = async () => {
      if (!category || !reportName) return;
      
      setLoading(true);
      try {
        const data = await fetchChartData(category, chartType, subType, reportName);
        if (data && !data.error) {
          setOptions(data);
        } else {
          console.error('获取图表数据失败:', data.error);
        }
      } catch (error) {
        console.error('加载图表数据出错:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [category, chartType, subType, reportName]);

  return (
    <Card title="数据可视化分析" className="chart-display">
      <Tabs className="sheets-tabs" defaultActiveKey={category}>
        {sheets && sheets.map(sheet => (
          <TabPane tab={sheet} key={sheet}>
            <Row gutter={[16, 16]} className="chart-controls">
              <Col span={12}>
                <Radio.Group
                  options={chartTypes}
                  onChange={e => setChartType(e.target.value)}
                  value={chartType}
                  optionType="button"
                  buttonStyle="solid"
                />
              </Col>
              <Col span={12}>
                <Radio.Group
                  options={subTypes}
                  onChange={e => setSubType(e.target.value)}
                  value={subType}
                  optionType="button"
                  buttonStyle="solid"
                />
              </Col>
            </Row>
            
            <div className="chart-container">
              {loading ? (
                <div className="chart-loading">
                  <Spin tip="图表加载中..." />
                </div>
              ) : options ? (
                <ReactECharts 
                  option={options} 
                  style={{ height: 400, width: '100%' }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div className="no-data">暂无数据</div>
              )}
            </div>
          </TabPane>
        ))}
      </Tabs>
    </Card>
  );
};

export default ChartDisplay; 