package com.clinora.notifications.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    name = "clinora.email.provider",
    havingValue = "unconfigured",
    matchIfMissing = true
)
public class UnconfiguredEmailDeliveryAdapter implements EmailDeliveryPort {

    @Override
    public void send(TransactionalEmail email) {
        throw new EmailDeliveryNotConfiguredException();
    }
}
