package com.clinora.notifications.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.config.EmailProperties;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

class SmtpEmailDeliveryAdapterTest {

    @Test
    void sendsToTheDynamicTransactionalRecipient() throws Exception {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);

        EmailProperties emailProperties = new EmailProperties();
        emailProperties.setFrom("Clinora AI <clinoraAIhealthcare@gmail.com>");

        SmtpEmailDeliveryAdapter adapter = new SmtpEmailDeliveryAdapter(mailSender, emailProperties);
        adapter.send(new TransactionalEmail(
            "clinorausers+patient1@gmail.com",
            "Verify your Clinora AI email",
            "Plain text verification body",
            "<p>HTML verification body</p>"
        ));

        verify(mailSender).send(message);
        assertEquals("Verify your Clinora AI email", message.getSubject());
        assertEquals("clinorausers+patient1@gmail.com", message.getAllRecipients()[0].toString());
        assertEquals("Clinora AI <clinoraAIhealthcare@gmail.com>", message.getFrom()[0].toString());
    }
}
