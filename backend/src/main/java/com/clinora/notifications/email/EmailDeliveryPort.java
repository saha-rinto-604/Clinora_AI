package com.clinora.notifications.email;

public interface EmailDeliveryPort {

    void send(TransactionalEmail email);
}
