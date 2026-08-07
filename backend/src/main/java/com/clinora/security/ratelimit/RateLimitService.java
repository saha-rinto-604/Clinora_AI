package com.clinora.security.ratelimit;

import java.time.Duration;

public interface RateLimitService {

    RateLimitDecision consume(String bucket, String subject, int limit, Duration window);
}
