import axios from 'axios';

const API_URL = 'http://192.168.10.155:5000';

export const fetchExcelFiles = async () => {
  try {
    const response = await axios.get(`${API_URL}/get/report`);
    return response.data;
  } catch (error) {
    console.error('获取Excel文件列表失败:', error);
    throw error;
  }
};

export const fetchExcelDetails = async (reportName) => {
  try {
    const response = await axios.get(`${API_URL}/get/report/description/${reportName}`);
    return response.data;
  } catch (error) {
    console.error('获取Excel详情失败:', error);
    throw error;
  }
};

export const loadExcelData = async (reportName) => {
  try {
    const response = await axios.get(`${API_URL}/load_data?report_name=${reportName}`);
    return response.data;
  } catch (error) {
    console.error('加载Excel数据失败:', error);
    throw error;
  }
};

export const getSheetData = async (reportName) => {
  try {
    const response = await axios.get(`${API_URL}/get_sheet_data?report_name=${reportName}`);
    return response.data;
  } catch (error) {
    console.error('获取Sheet数据失败:', error);
    throw error;
  }
};

export const fetchCategoryData = async (category, reportName) => {
  try {
    const response = await axios.get(`${API_URL}/category/${category}?report_name=${reportName}`);
    return response.data;
  } catch (error) {
    console.error('获取分类数据失败:', error);
    throw error;
  }
};

export const fetchChartData = async (category, chartType, subType, reportName) => {
  try {
    const response = await axios.get(`${API_URL}/chart/${category}/${chartType}/${subType}?report_name=${reportName}`);
    return response.data;
  } catch (error) {
    console.error('获取图表数据失败:', error);
    throw error;
  }
}; 