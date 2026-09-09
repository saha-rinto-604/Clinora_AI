package com.clinora.ai.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiMessagingConfig {

    @Bean
    Queue patientReportAiAnalysisQueue(
        @Value("${clinora.ai.queue:clinora.patient-report-ai-analysis}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }
}
