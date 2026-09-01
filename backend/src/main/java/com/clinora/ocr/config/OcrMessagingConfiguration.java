package com.clinora.ocr.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableRabbit
@EnableScheduling
public class OcrMessagingConfiguration {

    @Bean
    Queue patientReportExtractionQueue(
        @Value("${clinora.ocr.queue:clinora.patient-report-extraction}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }
}
