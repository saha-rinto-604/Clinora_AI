package com.clinora.notifications.email;

public class EmailDeliveryNotConfiguredException extends RuntimeException {

    public EmailDeliveryNotConfiguredException() {
        super("Transactional email provider is not configured");
    }
}
