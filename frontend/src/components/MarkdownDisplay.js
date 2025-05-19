import React from 'react';
import { Card } from 'antd';
import { marked } from 'marked';
import './MarkdownDisplay.css';

const MarkdownDisplay = ({ markdownContent }) => {
  // 设置marked选项
  marked.setOptions({
    breaks: true, // 启用换行符转换为<br>
    gfm: true,    // 启用GitHub风格的Markdown
  });

  // 如果没有内容，显示默认信息
  const content = markdownContent || '暂无分析报告';
  
  // 将markdown转换为HTML
  const createMarkup = () => {
    return { __html: marked(content) };
  };

  return (
    <Card title="数据分析报告" className="markdown-display">
      <div 
        className="markdown-content"
        dangerouslySetInnerHTML={createMarkup()} 
      />
    </Card>
  );
};

export default MarkdownDisplay; 