// Backend Server - Node.js + Express
// Este arquivo deve rodar em um servidor, NÃO no navegador
// As credenciais da ConnectPay ficam aqui, protegidas

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const app = express();

const PORT = process.env.PORT || 3000;
const CONNECTPAY_BASE_URL = 'https://api.connectpay.vc';
const CONNECTPAY_API_SECRET = process.env.CONNECTPAY_API_SECRET;
const CONNECTPAY_RECIPIENT_ID = process.env.CONNECTPAY_RECIPIENT_ID; // Opcional: para splits de pagamento
const TIKTOK_API_TOKEN = process.env.TIKTOK_API_TOKEN; // Token para TikTok Events API (Server-side)

// Middleware
app.use(cors());
app.use(express.json());

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

		// Validar API Secret
		if (!CONNECTPAY_API_SECRET) {
			return res.status(500).json({ 
				success: false, 
				message: 'CONNECTPAY_API_SECRET não configurado' 
			});
		}

		// Gerar ID de referência único (external_id)
		const externalId = 'ORD-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now();

		// Obter IP do cliente (se disponível)
		const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '127.0.0.1';

		// Preparar dados para ConnectPay
		const connectPayBody = {
			external_id: externalId,
			total_amount: parseFloat(amount),
			payment_method: 'PIX',
			webhook_url: callback_url || undefined,
			ip: clientIp,
			items: [
				{
					id: 'parafusadeira-48v-001',
					title: 'Parafusadeira Furadeira 48V 2 Baterias com Maleta e Acessórios',
					description: 'Parafusadeira Furadeira 48V 2 Baterias com Maleta e Acessórios',
					price: parseFloat(amount),
					quantity: 1,
					is_physical: true
				}
			],
			customer: {
				name: payer_name,
				email: req.body.email || '',
				phone: phone ? phone.replace(/\D/g, '') : '',
				document_type: 'CPF',
				document: req.body.document || ''
			}
		};

		// Adicionar splits se Recipient ID estiver configurado
		if (CONNECTPAY_RECIPIENT_ID) {
			connectPayBody.splits = [
				{
					recipient_id: CONNECTPAY_RECIPIENT_ID,
					percentage: 100 // 100% para o recipient (ajuste conforme necessário)
				}
			];
		}

		// Criar transação na ConnectPay
		const connectPayResponse = await fetch(`${CONNECTPAY_BASE_URL}/v1/transactions`, {
			method: 'POST',
			headers: {
				'api-secret': CONNECTPAY_API_SECRET,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(connectPayBody)
		});

		if (!connectPayResponse.ok) {
			const errorData = await connectPayResponse.json().catch(() => ({}));
			console.error('Erro ConnectPay:', errorData);
			return res.status(connectPayResponse.status).json({ 
				success: false, 
				message: errorData.message || errorData.error || 'Erro ao criar pedido Pix' 
			});
		}

		const data = await connectPayResponse.json();

		// Verificar se houve erro na resposta
		if (data.hasError) {
			return res.status(400).json({ 
				success: false, 
				message: 'Erro ao criar transação: ' + (data.message || 'Erro desconhecido')
			});
		}

		// Verificar se tem payload PIX
		if (!data.pix || !data.pix.payload) {
			return res.status(400).json({ 
				success: false, 
				message: 'Payload PIX não retornado pela ConnectPay'
			});
		}

		const pixPayload = data.pix.payload;

		// Gerar QR Code a partir do payload PIX
		let qrCodeBase64 = null;
		try {
			qrCodeBase64 = await QRCode.toDataURL(pixPayload, {
				errorCorrectionLevel: 'M',
				type: 'image/png',
				width: 400,
				margin: 2
			});
		} catch (qrError) {
			console.error('Erro ao gerar QR Code:', qrError);
			// Não falha o pedido se o QR Code não gerar, apenas loga o erro
		}

		// Enviar notificação para Google Sheets (se configurado)
		if (process.env.GOOGLE_SHEETS_WEBHOOK && process.env.GOOGLE_SHEETS_WEBHOOK !== 'https://script.google.com/macros/s/SEU_ID_AQUI/exec') {
			try {
				await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						timestamp: new Date().toISOString(),
						type: 'pix_order',
						order_id: data.external_id || data.id,
						transaction_id: data.id,
						payer_name,
						amount: parseFloat(amount),
						phone: phone || '',
						status: data.status || 'PENDING'
					})
				});
			} catch (error) {
				console.error('Erro ao enviar para Google Sheets:', error);
				// Não falha o pedido se o Google Sheets der erro
			}
		}

		// Retornar dados do Pix no formato esperado pelo frontend
		res.json({
			success: true,
			orderId: data.external_id || data.id,
			external_id: data.external_id || data.id,
			copy_past: pixPayload,
			copy_paste: pixPayload, // Alias
			code: pixPayload,
			payment: qrCodeBase64, // QR Code em base64 (data:image/png;base64,...)
			qrCode: qrCodeBase64, // Alias
			status: data.status || 'PENDING'
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
	console.log(`⚠️  Certifique-se de configurar CONNECTPAY_API_SECRET no arquivo .env`);
});
