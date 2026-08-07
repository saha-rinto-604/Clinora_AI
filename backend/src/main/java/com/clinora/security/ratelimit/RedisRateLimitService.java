package com.clinora.security.ratelimit;

import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

@Service
public class RedisRateLimitService implements RateLimitService {

    private static final DefaultRedisScript<Long> INCREMENT_SCRIPT = new DefaultRedisScript<>(
        "local current = redis.call('INCR', KEYS[1]); "
            + "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; "
            + "return current;",
        Long.class
    );

    private final StringRedisTemplate redisTemplate;
    private final RateLimitKeyFactory keyFactory;

    public RedisRateLimitService(StringRedisTemplate redisTemplate, RateLimitKeyFactory keyFactory) {
        this.redisTemplate = redisTemplate;
        this.keyFactory = keyFactory;
    }

    @Override
    public RateLimitDecision consume(String bucket, String subject, int limit, Duration window) {
        if (limit <= 0 || window == null || window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("Rate-limit policy must use a positive limit and window");
        }

        String key = keyFactory.create(bucket, subject);
        Long count = redisTemplate.execute(
            INCREMENT_SCRIPT,
            List.of(key),
            Long.toString(window.toMillis())
        );
        long used = count == null ? 1 : count;
        long remaining = Math.max(0, limit - used);
        Duration retryAfter = used > limit ? ttl(key, window) : Duration.ZERO;
        return new RateLimitDecision(used <= limit, remaining, retryAfter);
    }

    private Duration ttl(String key, Duration fallback) {
        Long ttlMillis = redisTemplate.getExpire(key, java.util.concurrent.TimeUnit.MILLISECONDS);
        if (ttlMillis == null || ttlMillis < 0) {
            return fallback;
        }
        return Duration.ofMillis(ttlMillis);
    }
}
