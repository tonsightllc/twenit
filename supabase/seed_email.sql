INSERT INTO public.inbound_emails (
    org_id,
    message_id,
    from_email,
    to_email,
    subject,
    body_text,
    status,
    received_at
)
SELECT 
    id as org_id,
    'msg_test_123',
    'customer@example.com',
    'soporte@tuempresa.com',
    'Test Email from SQL',
    'This is a test email inserted via SQL to verify the inbox.',
    'pending',
    NOW()
FROM organizations
LIMIT 1;
