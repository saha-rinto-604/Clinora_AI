package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.config.AccessApplicationProperties.Policy;
import com.clinora.security.ratelimit.RateLimitService;
import org.springframework.stereotype.Service;

@Service
public class AccessRateLimitGuard {
    private final RateLimitService rateLimitService;
    private final AccessApplicationProperties.RateLimits policies;

    public AccessRateLimitGuard(RateLimitService rateLimitService, AccessApplicationProperties properties){this.rateLimitService=rateLimitService;this.policies=properties.getRateLimits();}
    public void create(String ip,String email){check("access-create-ip",safe(ip),policies.getCreateIp());check("access-create-email",safe(email),policies.getCreateEmail());}
    public void verify(String ip){check("access-verify",safe(ip),policies.getVerifyIp());}
    public void accessLink(String ip,String email){check("access-link-ip",safe(ip),policies.getAccessLinkIp());check("access-link-email",safe(email),policies.getAccessLinkEmail());}
    public void session(String ip){check("access-session",safe(ip),policies.getSessionIp());}
    public void upload(String applicationId){check("access-upload",applicationId,policies.getUploadApplication());}
    public void submit(String applicationId){check("access-submit",applicationId,policies.getSubmitApplication());}
    private void check(String bucket,String subject,Policy policy){var d=rateLimitService.consume(bucket,subject,policy.getLimit(),policy.getWindow());if(!d.allowed())throw AccessApplicationException.rateLimited(d.retryAfter());}
    private String safe(String value){return value==null||value.isBlank()?"unknown":value;}
}
