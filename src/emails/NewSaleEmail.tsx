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

interface NewSaleEmailProps {
  customerName: string;
  productName: string;
  amount: string;
  unsubscribeUrl?: string;
  refundUrl?: string;
}

export default function NewSaleEmail({
  customerName = "Cliente",
  productName = "Producto",
  amount = "$0",
  unsubscribeUrl,
  refundUrl,
}: NewSaleEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Gracias por tu compra de {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>¡Gracias por tu compra!</Heading>

          <Text style={text}>
            Hola {customerName},
          </Text>

          <Text style={text}>
            Tu compra de <strong>{productName}</strong> por <strong>{amount}</strong> ha sido procesada exitosamente.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : "https://tu-dominio.com/dashboard"}>
              Ver mi cuenta
            </Button>
          </Section>

          <Text style={text}>
            Si tenés alguna pregunta, no dudes en contactarnos.
          </Text>

          {(unsubscribeUrl || refundUrl) && (
            <Section style={footerSection}>
              <Text style={footerText}>
                {unsubscribeUrl && (
                  <>
                    <a href={unsubscribeUrl} style={link}>Cancelar suscripción</a>
                    {refundUrl && " | "}
                  </>
                )}
                {refundUrl && (
                  <a href={refundUrl} style={link}>Solicitar reembolso</a>
                )}
              </Text>
            </Section>
          )}
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
  backgroundColor: "#0070f3",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 24px",
};

const footerSection = {
  marginTop: "32px",
  paddingTop: "16px",
  borderTop: "1px solid #e6e6e6",
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "1.5",
};

const link = {
  color: "#0070f3",
  textDecoration: "underline",
};
