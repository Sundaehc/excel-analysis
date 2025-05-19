import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Spin, Tabs, Select, Empty, Row, Col, Statistic, Checkbox, Button, Space } from 'antd';
import './VisualizationPanel.css';

const { TabPane } = Tabs;
const { Option } = Select;

const VisualizationPanel = ({ sheetsData, reportName }) => {
  const [activeSheet, setActiveSheet] = useState('');
  const [visualizations, setVisualizations] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState({});
  const [categoryOptions, setCategoryOptions] = useState({});
  const [chartInstances, setChartInstances] = useState({});

  // 生成可视化
  useEffect(() => {
    if (!sheetsData || !activeSheet || !sheetsData[activeSheet]) {
      setVisualizations([]);
      setMetrics({});
      setCategoryOptions({});
      setSelectedCategories({});
      return;
    }

    setLoading(true);
    try {
      // 获取当前工作表数据
      let sheetData = sheetsData[activeSheet];
      
      const basePeriodSheetKey = `${activeSheet}_基期`;
      if (sheetsData[basePeriodSheetKey]) {
        const basePeriodSheet = sheetsData[basePeriodSheetKey];
        const categoryColumn = getCategoryColumn(sheetData, activeSheet);
        
        if (categoryColumn) {
          // 计算环比数据
          sheetData = sheetData.map(currentItem => {
            // 跳过"是"和"否"的处理
            if (currentItem[categoryColumn] === '是' || currentItem[categoryColumn] === '否') {
              return currentItem;
            }
            
            // 查找对应的基期项目
            const baseItem = basePeriodSheet.find(
              baseRecord => baseRecord[categoryColumn] === currentItem[categoryColumn]
            );
            
            // 如果找到匹配的基期数据，计算环比
            if (baseItem) {
              const result = { ...currentItem };
              
              // 计算货号环比
              if (currentItem['上周货号数'] !== undefined && baseItem['上周货号数'] !== undefined && baseItem['上周货号数'] !== 0) {
                result['货号环比'] = calculateMoM(currentItem['上周货号数'], baseItem['上周货号数']);
              } 
              
              // 计算货值环比
              if (currentItem['上周货值'] !== undefined && baseItem['上周货值'] !== undefined && baseItem['上周货值'] !== 0) {
                result['货值环比'] = calculateMoM(currentItem['上周货值'], baseItem['上周货值']);
              } 
              
              // 计算库存环比
              if (currentItem['库存数'] !== undefined && baseItem['库存数'] !== undefined && baseItem['库存数'] !== 0) {
                result['库存环比'] = calculateMoM(currentItem['库存数'], baseItem['库存数']);
              }
              
              // 计算销售环比
              if (currentItem['上周销售'] !== undefined && baseItem['上周销售'] !== undefined && baseItem['上周销售'] !== 0) {
                result['销售环比'] = calculateMoM(currentItem['上周销售'], baseItem['上周销售']);
              } 
              
              // 计算UV环比
              if (currentItem['上周UV'] !== undefined && baseItem['上周UV'] !== undefined && baseItem['上周UV'] !== 0) {
                result['UV环比'] = calculateMoM(currentItem['上周UV'], baseItem['上周UV']);
              } 
              return result;
            }
            
            return currentItem;
          });
        }
      }
      
      // 获取数据指标
      const extractedMetrics = extractMetrics(sheetData);
      setMetrics(extractedMetrics);
      
      // 获取分类列
      const categoryColumn = getCategoryColumn(sheetData, activeSheet);
      
      // 获取分类列的唯一值
      if (categoryColumn) {
        const categories = [...new Set(sheetData.map(item => item[categoryColumn]))];
        // 过滤掉非分类值和特定价格段
        const filteredCategories = categories.filter(cat => {
          // 基本过滤条件
          if (cat === '是' || cat === '否' || cat === undefined || cat === null || cat === '') {
            return false;
          }
          
          // 对于"是否周新款"工作表，保留总计数据
          if (cat === '总计' && activeSheet !== '是否周新款') {
            return false;
          }
          
          // 对价格段和是否动销sheet进行特殊处理
          if ((activeSheet === '价格段' || activeSheet === '是否动销') && 
              (cat === '100-149' || cat === '150-199' || cat === '200-249' || cat === '250-299' || 
               cat === '300-349' || cat === '350-399' || cat === '400-449' || 
               cat === '450-499' || cat === '500-549' || cat === '550-599' || 
               cat === '600以上')){
            return false;
          }
          
          
          return true;
        });
        
        // 初始化所有类别为选中状态
        const newCategoryOptions = { ...categoryOptions };
        newCategoryOptions[activeSheet] = filteredCategories;
        setCategoryOptions(newCategoryOptions);
        
        // 初始化选中状态
        const newSelectedCategories = { ...selectedCategories };
        newSelectedCategories[activeSheet] = filteredCategories;
        setSelectedCategories(newSelectedCategories);
      }
      
      // 生成可视化选项
      const generatedVisualizations = generateVisualizations(sheetData, activeSheet);
      setVisualizations(generatedVisualizations);
    } catch (error) {
      console.error('生成可视化出错:', error);
    } finally {
      setLoading(false);
    }
  }, [sheetsData, activeSheet]);

  // 当sheets数据变化时，默认选择第一个sheet
  useEffect(() => {
    if (sheetsData && Object.keys(sheetsData).length > 0) {
      setActiveSheet(Object.keys(sheetsData)[0]);
    }
  }, [sheetsData]);

  // 处理图表实例保存
  const onChartReady = (chart, index) => {
    const newChartInstances = { ...chartInstances };
    newChartInstances[index] = chart;
    setChartInstances(newChartInstances);
  };

  // 处理类别选择变更
  const handleCategoryChange = (checkedValues) => {
    const newSelectedCategories = { ...selectedCategories };
    newSelectedCategories[activeSheet] = checkedValues;
    setSelectedCategories(newSelectedCategories);
  };

  // 处理全选/取消全选
  const handleSelectAll = (selectAll) => {
    const newSelectedCategories = { ...selectedCategories };
    if (selectAll) {
      newSelectedCategories[activeSheet] = [...categoryOptions[activeSheet]];
    } else {
      newSelectedCategories[activeSheet] = [];
    }
    setSelectedCategories(newSelectedCategories);
  };

  // 更新图表数据
  const updateChartData = (chartIndex) => {
    if (!chartInstances[chartIndex]) return;
    
    const chart = chartInstances[chartIndex];
    const visOptions = visualizations[chartIndex]?.options;
    if (!visOptions) return;
    
    // 基于选中的类别过滤数据
    const selectedCats = selectedCategories[activeSheet] || [];
    
    // 创建新的配置，仅包含选中的类别
    const filteredXAxisData = visOptions.xAxis.data.filter(category => 
      selectedCats.includes(category)
    );
    
    const filteredSeriesData = visOptions.series[0].data.filter((_, index) => 
      selectedCats.includes(visOptions.xAxis.data[index])
    );
    
    // 更新图表配置
    chart.setOption({
      xAxis: {
        data: filteredXAxisData
      },
      series: [{
        data: filteredSeriesData
      }]
    });
  };

  // 监听类别选择变更，更新图表
  useEffect(() => {
    // 当选中类别变化时，更新所有图表
    Object.keys(chartInstances).forEach(index => {
      updateChartData(Number(index));
    });
  }, [selectedCategories, activeSheet, chartInstances]);

  // 提取关键指标
  const extractMetrics = (data) => {
    try {
      // 检查是否有总计行
      let totalRow = null;
      if (Array.isArray(data)) {
        totalRow = data.find(row => 
          row['三级分类'] === '总计' || 
          row['是否本季新款'] === '总计' || 
          row['是否周新款'] === '总计' ||
          row['价格段'] === '总计' ||
          row['四级分类'] === '总计' ||
          row['资源分布'] === '总计' ||
          row['是否动销'] === '总计'
        );
      }
      
      // 如果找到总计行，提取关键指标
      if (totalRow) {
        return {
          totalGoods: (totalRow['上周货号数'] || totalRow['货号数'] || 0) ,
          totalValue: (totalRow['上周货值'] || totalRow['货值'] || 0) / 10000 , // 转换为万元
          totalInventory: (totalRow['库存数'] || 0) ,
          totalSales: (totalRow['上周销售'] || totalRow['销售'] || 0) / 10000 , // 转换为万元
        };
      }
      
      // 如果没有总计行，则计算列和
      let totalGoods = 0;
      let totalValue = 0;
      let totalInventory = 0;
      let totalSales = 0;
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          totalGoods += Number(row['上周货号数'] || row['货号数'] || 0);
          totalValue += Number(row['上周货值'] || row['货值'] || 0);
          totalInventory += Number(row['库存数'] || 0);
          totalSales += Number(row['上周销售'] || row['销售'] || 0);
        });
      }
      
      return {
        totalGoods: totalGoods ,
        totalValue: totalValue / 10000 , // 转换为万元
        totalInventory: totalInventory ,
        totalSales: totalSales / 10000 , // 转换为万元
      };
    } catch (error) {
      console.error('提取指标出错:', error);
      return {
        totalGoods: 0,
        totalValue: 0,
        totalInventory: 0,
        totalSales: 0
      };
    }
  };

  // 根据数据生成可视化
  const generateVisualizations = (data, sheetName) => {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }
      
      const visualizations = [];
      
      // 确定关键的分类列
      const categoryColumn = getCategoryColumn(data, sheetName);
      if (!categoryColumn) {
        return [];
      }
      
      // 获取分类列的唯一值
      const categories = [...new Set(data.map(item => item[categoryColumn]))];
      // 过滤掉非分类值和特定价格段
      const filteredCategories = categories.filter(cat => {
        // 基本过滤条件
        if (cat === '是' || cat === '否' || cat === undefined || cat === null || cat === '') {
          return false;
        }
        
        // 对于"是否周新款"工作表，保留总计数据
        if (cat === '总计' && sheetName !== '是否周新款') {
          return false;
        }
        
        // 对价格段和是否动销sheet进行特殊处理
        if ((sheetName === '价格段' || sheetName === '是否动销') && 
            (cat === '100-149' || cat === '150-199' || cat === '200-249' || cat === '250-299' || 
             cat === '300-349' || cat === '350-399' || cat === '400-449' || 
             cat === '450-499' || cat === '500-549' || cat === '550-599' || 
             cat === '600以上')) {
          return false;
        }
        
        // 特别过滤"是否动销"工作表中的"-2146826246"字段
        if (sheetName === '是否动销' && cat === '-2146826246') {
          return false;
        }
        
        return true;
      });
      
      // 生成环比分析图表
      // 货号环比
      if (hasProductNumberData(data)) {
        visualizations.push({
          title: '货号环比分析',
          type: 'bar',
          options: generatePercentBarChartOptions(
            data,
            categoryColumn,
            '货号环比',
            `${sheetName}货号环比分析`,
            filteredCategories
          )
        });
      }
      
      // 货值环比
      if (hasProductValueData(data)) {
        visualizations.push({
          title: '货值环比分析',
          type: 'bar',
          options: generatePercentBarChartOptions(
            data,
            categoryColumn,
            '货值环比',
            `${sheetName}货值环比分析`,
            filteredCategories
          )
        });
      }
      
      // 库存环比
      if (hasStockData(data)) {
        visualizations.push({
          title: '库存环比分析',
          type: 'bar',
          options: generatePercentBarChartOptions(
            data,
            categoryColumn,
            '库存环比',
            `${sheetName}库存环比分析`,
            filteredCategories
          )
        });
      }
      
      // 销售环比
      if (hasSaleData(data)) {
        visualizations.push({
          title: '销售环比分析',
          type: 'bar',
          options: generatePercentBarChartOptions(
            data,
            categoryColumn,
            '销售环比',
            `${sheetName}销售环比分析`,
            filteredCategories
          )
        });
      }
      
      // UV环比
      if (hasUVsData(data)) {
        visualizations.push({
          title: 'UV环比分析',
          type: 'bar',
          options: generatePercentBarChartOptions(
            data,
            categoryColumn,
            'UV环比',
            `${sheetName}UV环比分析`,
            filteredCategories
          )
        });
      }
      
      return visualizations;
    } catch (error) {
      console.error('生成可视化出错:', error);
      return [];
    }
  };

  // 获取分类列
  const getCategoryColumn = (data, sheetName) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    
    // 常见的分类列名
    const possibleColumns = ['三级分类', '是否本季新款', '是否周新款', '是否动销', '价格段', '四级分类', '资源分布'];
    // 根据sheet名称可能会有特定的分类列
    if (sheetName === '货盘概况') {
      // 不再特殊处理"是否动销"，使用其他可能的列
      for (const col of possibleColumns) {
        if (col !== '是否动销' && data[0].hasOwnProperty(col)) {
          return col;
        }
      }
    }
    
    // 检查这些列是否存在于数据中
    for (const col of possibleColumns) {
      if (data[0].hasOwnProperty(col)) {
        return col;
      }
    }
    
    // 如果没有找到预设的分类列，返回第一个非数值列
    const firstRow = data[0];
    for (const key in firstRow) {
      if (typeof firstRow[key] === 'string' && !key.includes('时间')) {
        return key;
      }
    }
    return null;
  };

  // 检查数据是否包含特定字段
  const hasSalesData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('上周销售')
    );
  };
  
  const hasGoodsData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('上周货号数')
    );
  };
  
  const hasValueData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('上周货值') 
    );
  };
  
  const hasInventoryData = (data) => {
    return data.some(item => item.hasOwnProperty('库存数'));
  };
  
  // 环比计算函数
  const calculateMoM = (current, base) => {
    if (base === 0) return 0;
    return parseFloat(((current - base) / base * 100).toFixed(2));
  };
  
  // 检查环比数据是否存在的
  const hasProductNumberData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('货号环比') || item.hasOwnProperty('环比')
    );
  };
  
  const hasProductValueData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('货值环比') || 
      (item.hasOwnProperty('环比') && hasValueData(data))
    );
  };
  
  const hasStockData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('库存环比') || 
      (item.hasOwnProperty('环比') && hasInventoryData(data))
    );
  };
  
  const hasSaleData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('销售环比') || 
      (item.hasOwnProperty('环比') && hasSalesData(data))
    );
  };

  // 添加UV环比检查函数
  const hasUVsData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('UV环比') || 
      (item.hasOwnProperty('环比') && hasUVData(data))
    );
  };

  // 检查数据是否包含UV数据
  const hasUVData = (data) => {
    return data.some(item => 
      item.hasOwnProperty('UV')
    );
  };

  // 生成环比分析图表（百分比柱状图）
  const generatePercentBarChartOptions = (data, categoryColumn, valueColumn, title, categories) => {
    // 获取数据
    const chartData = categories.map(category => {
      // 跳过"是"和"否"分类，对于"是否周新款"工作表不跳过"总计"
      if (category === '是' || category === '否' || (category === '总计' && title.indexOf('是否周新款') === -1)) {
        return { name: category, value: 0, originalValue: 0, baseValue: 0 };
      }
      
      const categoryData = data.filter(item => item[categoryColumn] === category);
      let value = 0;
      let valueType = '';
      
      // 确定数据类型
      if (valueColumn === '货号环比') {
        valueType = '货号数';
      } else if (valueColumn === '货值环比') {
        valueType = '货值';
      } else if (valueColumn === '库存环比') {
        valueType = '库存数';
      } else if (valueColumn === '销售环比') {
        valueType = '销售额';
      } else if (valueColumn === 'UV环比') {
        valueType = 'UV';
      }
      
      // 尝试不同的环比列名
      const possibleColumns = [valueColumn, '环比'];
      
      if (categoryData.length > 0) {
        // 获取环比值
        for (const item of categoryData) {
          for (const col of possibleColumns) {
            if (item.hasOwnProperty(col)) {
              // 处理可能的字符串百分比格式（如"12.5%"）
              let rawValue = item[col];
              // console.log("百分比", rawValue, typeof rawValue)
              if (typeof rawValue === 'string' && rawValue.includes('%')) {
                rawValue = parseFloat(rawValue.replace('%', ''));
              }
              if (typeof rawValue === 'number') {
                value = parseFloat(rawValue.toFixed(2));
              } else {
                value = 0;
              }
              break;
            }
          }
          if (value !== 0) break;
        }
      }
      return { name: category, value, valueType };
    });
    
    // 过滤掉没有环比数据的项目和"是"/"否"分类
    const filteredChartData = chartData.filter(item => 
      item.value !== 0 && 
      item.name !== '是' && 
      item.name !== '否' && 
      (item.name !== '总计' || title.indexOf('是否周新款') !== -1)
    );
    
    // 排序数据（按绝对值从大到小）
    filteredChartData.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    
    // 处理后的类别和值
    const xAxisData = filteredChartData.map(item => item.name);
    const seriesData = filteredChartData.map(item => item.value);
    
    // 创建参考线
    const markLine = {
      silent: true,
      lineStyle: {
        color: '#333'
      },
      data: [{
        yAxis: 0
      }]
    };
    
    // 生成ECharts配置
    return {
      title: {
        text: title,
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          const param = params[0];
          // 显示带正负号的百分比
          const value = parseFloat(param.value).toFixed(2);
          const valueStr = param.value >= 0 ? `+${value}%` : `${value}%`;
          return `${param.name}: ${valueStr}`;
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          interval: 0,
          rotate: xAxisData.length > 8 ? 30 : 0,
          textStyle: {
            fontSize: 12
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '环比百分比(%)',
        axisLine: {
          show: true
        },
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [{
        name: '环比百分比',
        data: seriesData,
        type: 'bar',
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(180, 180, 180, 0.2)'
        },
        label: {
          show: true,
          position: function(params) {
            // 正值在顶部，负值在底部
            return params.value >= 0 ? 'top' : 'bottom';
          },
          formatter: function(params) {
            // 显示带正负号的百分比
            const value = parseFloat(params.value).toFixed(2);
            return params.value >= 0 ? `+${value}%` : `${value}%`;
          },
          textStyle: function(params) {
            return {
              color: params.value >= 0 ? '#3f8600' : '#cf1322'
            };
          }
        },
        itemStyle: {
          color: function(params) {
            // 正值使用绿色，负值使用红色
            return params.data >= 0 ? '#91cc75' : '#ee6666';
          }
        },
        markLine: markLine
      }]
    };
  };

  // 渲染类别选择器
  const renderCategorySelector = () => {
    const options = categoryOptions[activeSheet] || [];
    const selected = selectedCategories[activeSheet] || [];
    
    if (options.length === 0) return null;
    
    return (
      <div className="category-selector">
        <div className="category-selector-header">
          <h4>选择显示类别:</h4>
          <Space>
            <Button size="small" onClick={() => handleSelectAll(true)}>全选</Button>
            <Button size="small" onClick={() => handleSelectAll(false)}>取消全选</Button>
          </Space>
        </div>
        <Checkbox.Group 
          options={options} 
          value={selected} 
          onChange={handleCategoryChange}
          className="category-checkbox-group" 
        />
      </div>
    );
  }; 

  return (
    <div className="visualization-panel">
      <Card title="可视化分析面板">
        {!sheetsData || Object.keys(sheetsData).length === 0 ? (
          <Empty description="暂无数据" />
        ) : (
          <>
            <div className="sheet-selector">
              <span className="selector-label">选择工作表：</span>
              <Select
                value={activeSheet}
                onChange={setActiveSheet}
                style={{ width: 300 }}
              >
                {Object.keys(sheetsData).map(sheet => (
                  <Option key={sheet} value={sheet}>{sheet}</Option>
                ))}
              </Select>
            </div>
            
            {loading ? (
              <div className="loading-container">
                <Spin size="large" tip="生成可视化中..." />
              </div>
            ) : (
              <>
                {/* 关键指标展示 */}
                <Row gutter={[16, 16]} className="metrics-container">
                  <Col span={6}>
                    <Statistic
                      title="总货号数"
                      value={metrics.totalGoods || 0}
                      precision={0}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="总货值(万元)"
                      value={metrics.totalValue || 0}
                      precision={2}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="总库存数"
                      value={metrics.totalInventory || 0}
                      precision={0}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="总销售额(万元)"
                      value={metrics.totalSales || 0}
                      precision={2}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                </Row>
                
                {/* 分类选择器 */}
                {renderCategorySelector()}
                
                {/* 可视化图表展示 */}
                {visualizations.length > 0 ? (
                  <Tabs defaultActiveKey="0" className="visualization-tabs">
                    {visualizations.map((vis, index) => (
                      <TabPane tab={vis.title} key={index}>
                        <div className="chart-container">
                          <ReactECharts
                            option={vis.options}
                            style={{ height: 400, width: '100%' }}
                            opts={{ renderer: 'canvas' }}
                            onChartReady={(chart) => onChartReady(chart, index)}
                          />
                        </div>
                      </TabPane>
                    ))}
                  </Tabs>
                ) : (
                  <Empty description="无法生成可视化图表" />
                )}
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default VisualizationPanel; 