package com.clinora.notifications.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PatientNotificationMessagingConfig {
    public static final String EXCHANGE = "clinora.patient.notifications";
    public static final String QUEUE = "clinora.patient.notifications.ready";
    public static final String ROUTING_KEY = "notification.ready";

    @Bean
    DirectExchange patientNotificationExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue patientNotificationQueue() {
        return new Queue(QUEUE, true);
    }

    @Bean
    Binding patientNotificationBinding(Queue patientNotificationQueue, DirectExchange patientNotificationExchange) {
        return BindingBuilder.bind(patientNotificationQueue).to(patientNotificationExchange).with(ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter patientNotificationMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
