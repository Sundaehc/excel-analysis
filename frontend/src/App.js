import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import ExcelList from './pages/ExcelList';
import ExcelDetail from './pages/ExcelDetail';
import Home from './pages/Home';
import './App.css';

const { Header, Content, Footer } = Layout;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/excel" element={
          <Layout className="app-layout">
            <Header className="app-header">
              <div className="logo">
                <span className="logo-text">Excel数据分析平台</span>
                <a href="http://localhost/chat" target="_blank" rel="noopener noreferrer" className="logo-text" style={{color: 'skyblue', marginLeft: 'auto'}}>
                  RAGFlow
                </a>
              </div>
            </Header>
            <Content className="app-content">
              <ExcelList />
            </Content>
            <Footer className="app-footer">
              Excel数据分析平台 ©{new Date().getFullYear()} 
            </Footer>
          </Layout>
        } />
        <Route path="/excel/:id" element={
          <Layout className="app-layout">
            <Header className="app-header">
              <div className="logo">
                <span className="logo-text">Excel数据分析平台</span>
              </div>
            </Header>
            <Content className="app-content">
              <ExcelDetail />
            </Content>
            <Footer className="app-footer">
              Excel数据分析平台 ©{new Date().getFullYear()} 
            </Footer>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
