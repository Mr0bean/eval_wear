const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8080;

// 获取本机局域网IP地址
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部IP和非IPv4地址
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
    // 处理根路径
    let filePath = req.url === '/' ? '/compare.html' : req.url;

    // 解码 URL 以处理中文路径
    filePath = decodeURIComponent(filePath);

    // 构建完整路径
    const fullPath = path.join(__dirname, filePath);

    // 获取文件扩展名
    const extname = path.extname(fullPath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 读取文件
    fs.readFile(fullPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - 文件未找到</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`服务器错误: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('=================================');
    console.log('   AI模型图片对比系统启动成功!   ');
    console.log('=================================');
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://${localIP}:${PORT}`);
    console.log(`\n局域网内的其他设备可以通过上述地址访问`);
    console.log(`\n按 Ctrl+C 停止服务器`);
    console.log('=================================\n');
});
