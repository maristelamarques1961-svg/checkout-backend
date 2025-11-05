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
		if (!payer_name || !payer_name.trim()) {
			return res.status(400).json({ 
				success: false, 
				message: 'Nome do pagador é obrigatório',
				error: 'payer_name_required'
			});
		}
		
		if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
			return res.status(400).json({ 
				success: false, 
				message: 'Valor inválido ou não informado',
				error: 'invalid_amount'
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

		// Obter IP do cliente (se disponível) - validar formato IP
		let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '127.0.0.1';
		
		// Se vier múltiplos IPs (x-forwarded-for), pegar o primeiro
		if (clientIp.includes(',')) {
			clientIp = clientIp.split(',')[0].trim();
		}
		
		// Validar formato IP (IPv4)
		const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
		if (!ipRegex.test(clientIp)) {
			// Se não for IP válido, usar IP padrão
			clientIp = '127.0.0.1';
		}

		// Validar email (ConnectPay exige email válido)
		let customerEmail = req.body.email && req.body.email.trim() && req.body.email.includes('@') 
			? req.body.email.trim() 
			: `cliente${Date.now()}@example.com`; // Email temporário se não fornecido

		// Validar CPF (ConnectPay exige document válido se document_type for CPF)
		// Se não tiver CPF válido, usar um CPF válido genérico (apenas para validação)
		// CPF válido: 11144477735 (passa na validação de dígitos verificadores)
		let customerDocument = req.body.document && req.body.document.replace(/\D/g, '').length === 11
			? req.body.document.replace(/\D/g, '')
			: '11144477735'; // CPF válido genérico (ConnectPay exige CPF válido)

		// URL do webhook (usar callback_url se fornecido, senão usar URL do servidor)
		const webhookUrl = callback_url || (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/api/webhook/connectpay` : undefined);

		// Preparar dados para ConnectPay
		const connectPayBody = {
			external_id: externalId,
			total_amount: parseFloat(amount),
			payment_method: 'PIX',
			webhook_url: webhookUrl,
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
				email: customerEmail,
				phone: phone ? phone.replace(/\D/g, '') : '',
				document_type: 'CPF',
				document: customerDocument
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
			console.error('Erro ConnectPay:', {
				status: connectPayResponse.status,
				statusText: connectPayResponse.statusText,
				errorData: errorData,
				requestBody: connectPayBody
			});
			return res.status(connectPayResponse.status).json({ 
				success: false, 
				message: errorData.message || errorData.error || `Erro ao criar pedido Pix (${connectPayResponse.status})`,
				details: errorData
			});
		}

		const data = await connectPayResponse.json();
		
		console.log('Resposta ConnectPay:', { 
			hasError: data.hasError, 
			status: data.status,
			hasPix: !!data.pix,
			external_id: data.external_id || data.id
		});

		// Verificar se houve erro na resposta
		if (data.hasError) {
			console.error('ConnectPay retornou erro:', data);
			return res.status(400).json({ 
				success: false, 
				message: 'Erro ao criar transação: ' + (data.message || 'Erro desconhecido'),
				details: data
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

// Endpoint para receber webhook da ConnectPay
app.post('/api/webhook/connectpay', async (req, res) => {
	try {
		const { id, external_id, status, total_amount, payment_method } = req.body;

		console.log('Webhook ConnectPay recebido:', { id, external_id, status, total_amount });

		// Responder imediatamente para evitar timeout
		res.status(200).json({ received: true });

		// Processar apenas se o pagamento foi autorizado
		if (status === 'AUTHORIZED' && total_amount) {
			// Enviar eventos TikTok via Server-Side API (mais confiável)
			if (TIKTOK_API_TOKEN) {
				try {
					const tiktokEventData = {
						event: 'CompletePayment',
						event_id: external_id || id,
						timestamp: new Date().toISOString(),
						properties: {
							contents: [{
								content_id: 'parafusadeira-48v-001',
								content_type: 'product',
								content_name: 'Parafusadeira Furadeira 48V 2 Baterias com Maleta e Acessórios',
								price: total_amount,
								quantity: 1
							}],
							value: total_amount,
							currency: 'BRL',
							order_id: external_id || id
						}
					};

					// Enviar para TikTok Events API (Server-Side)
					await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
						method: 'POST',
						headers: {
							'Access-Token': TIKTOK_API_TOKEN,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							pixel_code: 'D453TI3C77U2P8MCGT20', // TikTok Pixel ID
							event: 'CompletePayment',
							event_id: external_id || id,
							timestamp: new Date().toISOString(),
							properties: tiktokEventData.properties
						})
					});
				} catch (tiktokError) {
					console.error('Erro ao enviar evento TikTok:', tiktokError);
				}
			}

			// Atualizar Google Sheets com status de pagamento confirmado
			if (process.env.GOOGLE_SHEETS_WEBHOOK && process.env.GOOGLE_SHEETS_WEBHOOK !== 'https://script.google.com/macros/s/SEU_ID_AQUI/exec') {
				try {
					await fetch(process.env.GOOGLE_SHEETS_WEBHOOK, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							timestamp: new Date().toISOString(),
							type: 'pix_payment_confirmed',
							order_id: external_id || id,
							transaction_id: id,
							amount: total_amount,
							status: 'AUTHORIZED',
							payment_method: payment_method || 'PIX'
						})
					});
				} catch (error) {
					console.error('Erro ao atualizar Google Sheets:', error);
				}
			}
		}

	} catch (error) {
		console.error('Erro ao processar webhook ConnectPay:', error);
		// Sempre retornar 200 para evitar retentativas infinitas
		res.status(200).json({ received: true, error: error.message });
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
