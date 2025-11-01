// Backend Server - Node.js + Express
// Este arquivo deve rodar em um servidor, NÃO no navegador
// As credenciais da HorsePay ficam aqui, protegidas

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;
const HORSEPAY_BASE_URL = 'https://api.horsepay.io';

// Middleware
app.use(cors());
app.use(express.json());

// Variável para armazenar token de autenticação
let horsePayToken = null;
let tokenExpiry = null;

// Função para autenticar com HorsePay
async function authenticateHorsePay() {
	try {
		// Verificar se já temos um token válido
		if (horsePayToken && tokenExpiry && Date.now() < tokenExpiry) {
			return horsePayToken;
		}

		const response = await fetch(`${HORSEPAY_BASE_URL}/auth/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_key: process.env.HORSEPAY_CLIENT_KEY,
				client_secret: process.env.HORSEPAY_CLIENT_SECRET
			})
		});

		if (!response.ok) {
			throw new Error('Erro na autenticação HorsePay');
		}

		const data = await response.json();
		horsePayToken = data.access_token;
		tokenExpiry = Date.now() + (50 * 60 * 1000); // Token válido por 50 minutos
		
		return horsePayToken;
	} catch (error) {
		console.error('Erro ao autenticar HorsePay:', error);
		throw error;
	}
}

// Endpoint para criar pedido Pix
app.post('/api/create-pix', async (req, res) => {
	try {
		const { payer_name, amount, phone, callback_url } = req.body;

		// Validações
		if (!payer_name || !amount) {
			return res.status(400).json({ 
				success: false, 
				message: 'Nome do pagador e valor são obrigatórios' 
			});
		}

		// Autenticar com HorsePay
		const token = await authenticateHorsePay();

		// Gerar ID de referência único
		const clientReferenceId = 'ORD-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now();

		// Criar pedido Pix na HorsePay
		const horsePayResponse = await fetch(`${HORSEPAY_BASE_URL}/transaction/neworder`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				payer_name,
				amount: parseFloat(amount),
				callback_url: callback_url || undefined,
				client_reference_id: clientReferenceId,
				phone: phone ? phone.replace(/\D/g, '') : undefined
			})
		});

		if (!horsePayResponse.ok) {
			const errorData = await horsePayResponse.json();
			return res.status(horsePayResponse.status).json({ 
				success: false, 
				message: errorData.message || 'Erro ao criar pedido Pix' 
			});
		}

		const data = await horsePayResponse.json();

		// Enviar notificação para Google Sheets (se configurado)
		if (process.env.GOOGLE_SHEETS_WEBHOOK && process.env.GOOGLE_SHEETS_WEBHOOK !== 'https://script.google.com/macros/s/SEU_ID_AQUI/exec') {
			try {
				await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						timestamp: new Date().toISOString(),
						type: 'pix_order',
						order_id: data.external_id,
						payer_name,
						amount: parseFloat(amount),
						phone: phone || '',
						status: 'pending'
					})
				});
			} catch (error) {
				console.error('Erro ao enviar para Google Sheets:', error);
				// Não falha o pedido se o Google Sheets der erro
			}
		}

		// Retornar dados do Pix
		res.json({
			success: true,
			orderId: data.external_id,
			external_id: data.external_id,
			copy_past: data.copy_past,
			copy_paste: data.copy_past, // Alias
			code: data.copy_past,
			payment: data.payment, // QR Code em base64
			qrCode: data.payment,
			status: data.status
		});

	} catch (error) {
		console.error('Erro ao criar pedido Pix:', error);
		res.status(500).json({ 
			success: false, 
			message: 'Erro interno do servidor',
			error: error.message 
		});
	}
});

// Health check
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
	console.log(`🚀 Servidor rodando na porta ${PORT}`);
	console.log(`📡 API disponível em http://localhost:${PORT}/api`);
	console.log(`⚠️  Certifique-se de configurar as variáveis de ambiente no arquivo .env`);
});

