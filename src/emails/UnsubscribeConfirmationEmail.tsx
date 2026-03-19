import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface UnsubscribeConfirmationEmailProps {
  customerName: string;
  productName: string;
  endDate: string;
  resubscribeUrl?: string;
  offerDiscount?: boolean;
  discountPercent?: number;
}

export default function UnsubscribeConfirmationEmail({
  customerName = "Cliente",
  productName = "tu suscripción",
  endDate = "próximamente",
  resubscribeUrl,
  offerDiscount = false,
  discountPercent = 20,
}: UnsubscribeConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirmación de cancelación de {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Tu suscripción ha sido cancelada</Heading>
          
          <Text style={text}>
            Hola {customerName},
          </Text>
          
          <Text style={text}>
            Tu suscripción a <strong>{productName}</strong> ha sido cancelada. 
            Tendrás acceso hasta el <strong>{endDate}</strong>.
          </Text>

          <Text style={text}>
            Lamentamos verte partir. Si hay algo que podamos mejorar, nos encantaría escucharte.
          </Text>

          {offerDiscount && (
            <Section style={offerSection}>
              <Text style={offerText}>
                ¿Cambiaste de opinión? Te ofrecemos un <strong>{discountPercent}% de descuento</strong> para que vuelvas.
              </Text>
              {resubscribeUrl && (
                <Button style={button} href={resubscribeUrl}>
                  Volver con {discountPercent}% OFF
                </Button>
              )}
            </Section>
          )}

          {!offerDiscount && resubscribeUrl && (
            <Section style={buttonSection}>
              <Button style={secondaryButton} href={resubscribeUrl}>
                Reactivar suscripción
              </Button>
            </Section>
          )}

          <Text style={footerText}>
            Si tenés alguna pregunta, no dudes en contactarnos.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
  borderRadius: "8px",
};

const h1 = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.25",
  marginBottom: "24px",
};

const text = {
  color: "#4a4a4a",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const buttonSection = {
  textAlign: "center" as const,
  marginTop: "32px",
  marginBottom: "32px",
};

const button = {
  backgroundColor: "#10b981",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 24px",
};

const secondaryButton = {
  backgroundColor: "#6b7280",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 24px",
};

const offerSection = {
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  padding: "24px",
  marginTop: "24px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const offerText = {
  color: "#166534",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const footerText = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "1.5",
  marginTop: "32px",
};
