package com.clinora.notifications.email;

import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@Configuration
@ConditionalOnProperty(name = "clinora.email.provider", havingValue = "smtp")
public class SmtpMailConfiguration {

    private static final String DEFAULT_SMTP_HOST = "smtp.gmail.com";
    private static final int DEFAULT_SMTP_PORT = 587;
    private static final String DEFAULT_TIMEOUT_MS = "10000";

    @Bean
    JavaMailSender smtpJavaMailSender(Environment environment) {
        String username = required(environment, "SMTP_USERNAME");
        String password = required(environment, "SMTP_PASSWORD");
        String host = environment.getProperty("SMTP_HOST", DEFAULT_SMTP_HOST);
        int port = Integer.parseInt(environment.getProperty("SMTP_PORT", String.valueOf(DEFAULT_SMTP_PORT)));

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(username);
        sender.setPassword(password);
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());

        Properties properties = sender.getJavaMailProperties();
        properties.put("mail.transport.protocol", "smtp");
        properties.put("mail.smtp.auth", "true");
        properties.put("mail.smtp.starttls.enable", "true");
        properties.put("mail.smtp.starttls.required", "true");
        properties.put("mail.smtp.connectiontimeout", DEFAULT_TIMEOUT_MS);
        properties.put("mail.smtp.timeout", DEFAULT_TIMEOUT_MS);
        properties.put("mail.smtp.writetimeout", DEFAULT_TIMEOUT_MS);
        properties.put("mail.debug", "false");

        return sender;
    }

    private String required(Environment environment, String name) {
        String value = environment.getProperty(name, "");
        if (value.isBlank()) {
            throw new IllegalStateException(name + " is required when EMAIL_PROVIDER=smtp");
        }
        return value;
    }
}
