import React, { useEffect, useRef } from 'react';
import { Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // 设置canvas尺寸为窗口尺寸
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    
    // 创建气泡数组
    const bubbles = [];
    const bubbleCount = 25;
    
    // 气泡颜色数组 - 淡蓝色、淡紫色和淡粉色调
    const bubbleColors = [
      'rgba(173, 216, 230, 0.2)', // 淡蓝色
      'rgba(200, 191, 231, 0.2)', // 淡紫色
      'rgba(255, 182, 193, 0.2)', // 淡粉色
      'rgba(173, 216, 230, 0.3)', // 稍深的淡蓝色
      'rgba(200, 191, 231, 0.3)', // 稍深的淡紫色
      'rgba(221, 160, 221, 0.2)', // 淡紫色
    ];
    
    // 初始化气泡
    for (let i = 0; i < bubbleCount; i++) {
      const size = Math.random() * 120 + 30; // 更大范围的气泡尺寸
      bubbles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: size,
        dx: (Math.random() * 0.6 - 0.3) * (100 / size), // 更慢的移动，大气泡移动更慢
        dy: (Math.random() * 0.6 - 0.3) * (100 / size),
        opacity: Math.random() * 0.3 + 0.1,
        color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)]
      });
    }
    
    // 动画循环
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 绘制并移动每个气泡
      bubbles.forEach(bubble => {
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fillStyle = bubble.color;
        ctx.fill();
        
        // 移动气泡 - 更加缓慢柔和的移动
        bubble.x += bubble.dx;
        bubble.y += bubble.dy;
        
        // 检查边界并反弹 - 使用更柔和的边界处理
        if (bubble.x < -bubble.radius * 2) {
          bubble.x = canvas.width + bubble.radius;
        } else if (bubble.x > canvas.width + bubble.radius * 2) {
          bubble.x = -bubble.radius;
        }
        
        if (bubble.y < -bubble.radius * 2) {
          bubble.y = canvas.height + bubble.radius;
        } else if (bubble.y > canvas.height + bubble.radius * 2) {
          bubble.y = -bubble.radius;
        }
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', setCanvasSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  const handleExplore = () => {
    navigate('/excel');
  };

  return (
    <div className="home-container">
      <canvas ref={canvasRef} className="bubble-canvas"></canvas>
      <div className="content-overlay">
        <motion.h1 
          className="title"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          Analyze Your Data
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Button 
            type="primary" 
            size="large" 
            className="explore-button"
            onClick={handleExplore}
          >
            Go Go Go <ArrowRightOutlined />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Home; 