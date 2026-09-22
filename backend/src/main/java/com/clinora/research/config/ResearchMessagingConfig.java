package com.clinora.research.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ResearchMessagingConfig {

    public static final String DEFAULT_RESEARCH_DATASET_QUEUE = "clinora.research.dataset-generation";

    @Bean
    Queue researchDatasetGenerationQueue(
            @Value("${clinora.research.dataset-generation-queue:" + DEFAULT_RESEARCH_DATASET_QUEUE + "}") String queueName
    ) {
        return QueueBuilder.durable(queueName).build();
    }
}
