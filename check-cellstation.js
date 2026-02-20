// Check CellStation API connection
const CELL_STATION_API = 'https://api.cellstation.co.uk/v1';

async function testConnection() {
  try {
    const response = await fetch(`${CELL_STATION_API}/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status:', response.status);
    console.log('Response:', await response.text());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testConnection();
