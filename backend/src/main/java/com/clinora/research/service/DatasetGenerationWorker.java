package com.clinora.research.service;

import com.clinora.research.config.ResearchMessagingConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class DatasetGenerationWorker {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatasetGenerationWorker.class);

    private final DatasetGenerationService generationService;

    public DatasetGenerationWorker(DatasetGenerationService generationService) {
        this.generationService = generationService;
    }

    @RabbitListener(queues = "${clinora.research.dataset-generation-queue:" + ResearchMessagingConfig.DEFAULT_RESEARCH_DATASET_QUEUE + "}")
    public void onMessage(String rawJobId) {
        UUID jobId;
        try {
            jobId = UUID.fromString(rawJobId);
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Received invalid dataset generation job message payload: {}", rawJobId);
            return;
        }

        LOGGER.info("Processing dataset generation job from queue: {}", jobId);
        generationService.processJob(jobId);
    }
}
