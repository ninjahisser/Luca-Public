// API Configuration
// Toggle between local development and production
const USE_LOCAL_API = true; // Set to false to use production PythonAnywhere API

const LOCAL_API_URL = 'http://127.0.0.1:5000/api';
const PRODUCTION_API_URL = 'https://SethVdB.pythonanywhere.com/api';

const API_BASE_URL = USE_LOCAL_API ? LOCAL_API_URL : PRODUCTION_API_URL;

console.log('Using API:', API_BASE_URL);
