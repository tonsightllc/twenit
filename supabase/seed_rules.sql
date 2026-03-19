-- Seed default automation rules
-- This script assumes an organization ID will be provided or it runs in a context where it can select one.
-- Ideally, this should be run per-organization setup.
-- For the purpose of this seed, we will create a function to seed rules for a given org_id.

CREATE OR REPLACE FUNCTION seed_default_automation_rules(target_org_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Onboarding: Welcome New Client (Pro/Enterprise)
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Bienvenida Nuevo Cliente (Pro/Enterprise)',
        'new_subscription',
        '[
            {"field": "plan_name", "operator": "in", "value": ["Pro", "Enterprise"]}
        ]'::jsonb,
        'send_email',
        '{"template_name": "welcome_pro"}'::jsonb,
        true,
        10
    );

    -- 2. Onboarding: Activation Reminder
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Recordatorio de Activación',
        'activation_pending',
        '[
            {"field": "days_pending", "operator": "gt", "value": 3}
        ]'::jsonb,
        'send_email',
        '{"template_name": "activation_reminder"}'::jsonb,
        true,
        5
    );

    -- 3. Sales: High Ticket Alert
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Alerta de Venta High-Ticket',
        'new_sale',
        '[
            {"field": "amount", "operator": "gt", "value": 500}
        ]'::jsonb,
        'create_ticket',
        '{"subject": "Nueva Venta High-Ticket", "priority": "high", "assign_team": "sales"}'::jsonb,
        true,
        5
    );

    -- 4. Retention: Cancelation Offer
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Oferta por Cancelación Reciente',
        'subscription_canceled',
        '[
            {"field": "subscription_age_days", "operator": "lt", "value": 90}
        ]'::jsonb,
        'send_email',
        '{"template_name": "retention_discount", "offer_code": "STAY20"}'::jsonb,
        true,
        10
    );

    -- 5. Retention: Exit Interview
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Entrevista de Salida (Clientes Antiguos)',
        'subscription_canceled',
        '[
            {"field": "subscription_age_days", "operator": "gt", "value": 365}
        ]'::jsonb,
        'create_ticket',
        '{"subject": "Exit Interview - Cliente Antiguo", "source": "manual", "priority": "normal"}'::jsonb,
        true,
        5
    );

    -- 6. Risk: Fraud Pause
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Pausar por Alerta de Fraude',
        'efw_created',
        '[
            {"field": "risk_score", "operator": "gt", "value": 75}
        ]'::jsonb,
        'pause_subscription',
        '{}'::jsonb,
        true,
        20
    );

    -- 7. Support: Dispute Alert
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Alerta de Disputa',
        'dispute_created',
        '[]'::jsonb,
        'create_ticket',
        '{"subject": "URGENTE: Disputa Recibida", "priority": "urgent"}'::jsonb,
        true,
        20
    );

    -- 8. Support: Email to Ticket
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Convertir Email a Ticket (Ayuda/Error)',
        'email_received',
        '[
            {"field": "subject", "operator": "contains_any", "value": ["Ayuda", "Error", "Problema", "Fallo"]}
        ]'::jsonb,
        'create_ticket',
        '{"source": "email"}'::jsonb,
        true,
        5
    );
    
    -- 9. Recover: Payment Failed (New)
    INSERT INTO automation_rules (org_id, name, trigger_type, conditions, action_type, action_config, enabled, priority)
    VALUES (
        target_org_id,
        'Fallo de Pago - Primer Aviso',
        'invoice_payment_failed',
        '[
            {"field": "attempt_count", "operator": "eq", "value": 1}
        ]'::jsonb,
        'send_email',
        '{"template_name": "payment_failed_retry"}'::jsonb,
        true,
        10
    );

END;
$$ LANGUAGE plpgsql;
