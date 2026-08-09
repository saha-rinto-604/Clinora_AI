package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.security.ratelimit.RateLimitService;
import java.time.Duration;
import org.springframework.stereotype.Service;

@Service
public class AccessRateLimitGuard {
    private final RateLimitService rateLimitService;
    public AccessRateLimitGuard(RateLimitService rateLimitService){this.rateLimitService=rateLimitService;}
    public void create(String ip,String email){check("access-create-ip",safe(ip),10,Duration.ofHours(1));check("access-create-email",safe(email),4,Duration.ofHours(1));}
    public void verify(String ip){check("access-verify",safe(ip),30,Duration.ofHours(1));}
    public void accessLink(String email){check("access-link",safe(email),8,Duration.ofHours(1));}
    public void session(String ip){check("access-session",safe(ip),30,Duration.ofHours(1));}
    public void upload(String applicationId){check("access-upload",applicationId,30,Duration.ofHours(1));}
    public void submit(String applicationId){check("access-submit",applicationId,10,Duration.ofHours(1));}
    private void check(String bucket,String subject,int limit,Duration window){var d=rateLimitService.consume(bucket,subject,limit,window);if(!d.allowed())throw AccessApplicationException.rateLimited(d.retryAfter());}
    private String safe(String value){return value==null||value.isBlank()?"unknown":value;}
}
