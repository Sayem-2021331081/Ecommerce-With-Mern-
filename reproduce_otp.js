const axios = require('axios');

async function testOTP() {
    try {
        // Assuming the server is running on localhost:5000 based on typical MERN setups or vite proxy
        // I need to check the backend port. usually 5000 or 8080.
        // Let's check app.js or index.js to find the port.
        // For now, I'll assume 5000 and if it fails I'll check.
        const response = await axios.get('http://localhost:5020/api/v1/UserOTP/test@example.com');
        console.log('Response:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error Response:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testOTP();
