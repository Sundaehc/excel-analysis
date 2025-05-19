import React from 'react';
import { Card, Tag } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './ExcelCard.css';

const ExcelCard = ({ excel }) => {
  // 提取文件名中的标签
  const getTagsFromName = (name) => {
    if (!name) return [];
    
    const tags = name.replace('.xlsx', '').split(/[_\-\.]/);
    return tags.filter(tag => tag.length > 0);
  };
  
  // 格式化日期显示
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return dayjs(dateString).format('YYYY-MM-DD');
  };

  return (
    <Link to={`/excel/${encodeURIComponent(excel.report_name)}`} className="excel-card-link">
      <Card 
        className="excel-card"
        hoverable
      >
        <div className="excel-icon">
          <FileExcelOutlined style={{ fontSize: '40px', color: '#52c41a' }} />
        </div>
        <div className="excel-info">
          <h3>{excel.report_name}</h3>
          <p>更新于: {formatDate(excel.create_time)}</p>
          <div className="excel-tags">
            {getTagsFromName(excel.report_name).map(tag => (
              <Tag key={tag} color="green">{tag}</Tag>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default ExcelCard; 