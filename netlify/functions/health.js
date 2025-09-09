// Simple healthcheck to verify Netlify Functions are wired correctly
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ok: true,
      function: 'health',
      ts: new Date().toISOString()
    })
  };
};
