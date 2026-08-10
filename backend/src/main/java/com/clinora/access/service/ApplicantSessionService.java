package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.ApplicantSession;
import com.clinora.access.repository.ApplicantSessionRepository;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.token.SecureTokenService;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApplicantSessionService {
    public static final String COOKIE_NAME = "clinora_applicant";
    private final ApplicantSessionRepository repository;
    private final SecureTokenService secureTokenService;
    private final AccessApplicationProperties properties;
    private final Clock clock;

    public ApplicantSessionService(ApplicantSessionRepository repository, SecureTokenService secureTokenService, AccessApplicationProperties properties, Clock clock) {
        this.repository=repository; this.secureTokenService=secureTokenService; this.properties=properties; this.clock=clock;
    }

    @Transactional
    public IssuedApplicantSession issue(UUID applicationId, String userAgent, String ipAddress) {
        var secret=secureTokenService.generate();
        UUID sessionId=UUID.randomUUID();
        var now=clock.instant();
        repository.save(new ApplicantSession(sessionId, applicationId, secret.tokenHash(), now, now.plus(properties.getSessionTtl()), truncate(userAgent,500), truncate(ipAddress,64)));
        return new IssuedApplicantSession(sessionId + "." + secret.rawToken(), properties.getSessionTtl());
    }

    @Transactional
    public UUID requireApplication(String rawCookie) {
        Parsed parsed=parse(rawCookie);
        var session=repository.findById(parsed.sessionId()).orElseThrow(AccessApplicationException::sessionInvalid);
        var now=clock.instant();
        if(!session.activeAt(now) || !secureTokenService.hashesMatch(session.getTokenHash(), secureTokenService.hash(parsed.secret()))) throw AccessApplicationException.sessionInvalid();
        session.touch(now);
        return session.getApplicationId();
    }

    @Transactional
    public void revoke(String rawCookie) {
        if(rawCookie==null || rawCookie.isBlank()) return;
        Parsed parsed=parse(rawCookie);
        repository.findById(parsed.sessionId()).ifPresent(session->session.revoke(clock.instant()));
    }

    @Transactional
    public void revokeAll(String rawCookie) {
        UUID applicationId=requireApplication(rawCookie);
        var now=clock.instant();
        repository.findAllByApplicationId(applicationId).stream()
            .filter(session->session.activeAt(now))
            .forEach(session->session.revoke(now));
    }

    private Parsed parse(String raw) {
        if(raw==null) throw AccessApplicationException.sessionInvalid();
        int dot=raw.indexOf('.');
        if(dot<1 || dot==raw.length()-1) throw AccessApplicationException.sessionInvalid();
        try { return new Parsed(UUID.fromString(raw.substring(0,dot)), raw.substring(dot+1)); }
        catch(IllegalArgumentException ex){ throw AccessApplicationException.sessionInvalid(); }
    }
    private String truncate(String value,int max){return value==null?null:value.substring(0,Math.min(max,value.length()));}
    private record Parsed(UUID sessionId,String secret){}
    public record IssuedApplicantSession(String rawCookieValue, java.time.Duration ttl){}
}
