package com.clinora.notifications.email;

public record TransactionalEmail(String to, String subject, String textBody, String htmlBody) {
}
