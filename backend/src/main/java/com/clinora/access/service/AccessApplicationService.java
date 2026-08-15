package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.*;
import com.clinora.access.repository.*;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import com.clinora.security.token.GeneratedSecureToken;
import com.clinora.security.token.SecureTokenService;
import com.clinora.users.repository.UserAccountRepository;
import com.clinora.users.service.EmailAddressNormalizer;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessApplicationService {
    private static final List<ApplicationStatus> TERMINAL = List.of(ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN, ApplicationStatus.ACTIVATED);
    private final AccessApplicationRepository applications;
    private final DoctorApplicationDetailRepository doctorDetails;
    private final ResearcherApplicationDetailRepository researcherDetails;
    private final DoctorQualificationRepository qualifications;
    private final ApplicationDocumentRepository documents;
    private final ApplicationTokenRepository tokens;
    private final ApplicationEventRepository events;
    private final UserAccountRepository users;
    private final EmailAddressNormalizer emailNormalizer;
    private final SecureTokenService secureTokenService;
    private final ApplicantSessionService sessions;
    private final AccessApplicationMailService mail;
    private final AccessApplicationProperties properties;
    private final AuthAuditService audit;
    private final Clock clock;

    public AccessApplicationService(AccessApplicationRepository applications,DoctorApplicationDetailRepository doctorDetails,ResearcherApplicationDetailRepository researcherDetails,DoctorQualificationRepository qualifications,ApplicationDocumentRepository documents,ApplicationTokenRepository tokens,ApplicationEventRepository events,UserAccountRepository users,EmailAddressNormalizer emailNormalizer,SecureTokenService secureTokenService,ApplicantSessionService sessions,AccessApplicationMailService mail,AccessApplicationProperties properties,AuthAuditService audit,Clock clock){
        this.applications=applications;this.doctorDetails=doctorDetails;this.researcherDetails=researcherDetails;this.qualifications=qualifications;this.documents=documents;this.tokens=tokens;this.events=events;this.users=users;this.emailNormalizer=emailNormalizer;this.secureTokenService=secureTokenService;this.sessions=sessions;this.mail=mail;this.properties=properties;this.audit=audit;this.clock=clock;
    }

    @Transactional
    public void create(ApplicationType type,AccessApplicationModels.CreateRequest request,String ip,String userAgent){
        if(!request.consentToApplicationProcessing()) throw AccessApplicationException.validation("Consent to application processing is required.");
        String normalized=emailNormalizer.normalize(require(request.email(),"Email is required."));
        if(users.existsByNormalizedEmail(normalized)){
            audit.record(null,AuthAuditAction.ACCESS_APPLICATION_CREATED,AuthAuditOutcome.REJECTED,ip,userAgent,null,"existing-user-email");
            return;
        }
        var existing=applications.findFirstByNormalizedEmailAndStatusNotIn(normalized,TERMINAL).orElse(null);
        if(existing!=null){
            sendResumeOrVerification(existing,ip,userAgent);
            return;
        }
        var now=clock.instant();
        var app=applications.save(new AccessApplication(type,require(request.firstName(),"First name is required."),require(request.lastName(),"Last name is required."),request.email().trim(),normalized,trim(request.phone()),trim(request.countryCode()),now));
        if(type==ApplicationType.DOCTOR) doctorDetails.save(new DoctorApplicationDetail(app.getId())); else researcherDetails.save(new ResearcherApplicationDetail(app.getId()));
        events.save(new ApplicationEvent(app.getId(),ApplicationEventType.APPLICATION_CREATED,"Professional access application started.",now));
        GeneratedSecureToken token=secureTokenService.generate();
        tokens.save(new ApplicationToken(app.getId(),ApplicationTokenType.EMAIL_VERIFICATION,token.tokenHash(),now.plus(properties.getEmailVerificationTtl()),now));
        mail.sendVerification(app.getEmail(),app.getFirstName(),token.rawToken());
        events.save(new ApplicationEvent(app.getId(),ApplicationEventType.EMAIL_VERIFICATION_SENT,"Application email verification sent.",now));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_VERIFICATION_SENT,AuthAuditOutcome.SUCCESS,ip,userAgent,app.getId().toString(),"type="+type);
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_CREATED,AuthAuditOutcome.SUCCESS,ip,userAgent,app.getId().toString(),"type="+type);
    }

    @Transactional
    public AccessApplicationModels.VerificationResult verifyEmail(String rawToken,String ip,String userAgent){
        var now=clock.instant();
        var token=verificationToken(rawToken,now);
        var app=applications.findById(token.getApplicationId()).orElseThrow(AccessApplicationException::invalidToken);
        if(users.existsByNormalizedEmail(app.getNormalizedEmail())){
            throw new AccessApplicationException(HttpStatus.CONFLICT,"APPLICATION_EMAIL_UNAVAILABLE","This email can no longer be used for a professional application.");
        }
        app.markEmailVerified(now); token.consume(now);
        events.save(new ApplicationEvent(app.getId(),ApplicationEventType.EMAIL_VERIFIED,"Application email verified.",now));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_EMAIL_VERIFIED,AuthAuditOutcome.SUCCESS,ip,userAgent,app.getId().toString(),"type="+app.getApplicationType());
        tokens.deleteAllByApplicationIdAndTokenType(app.getId(),ApplicationTokenType.PORTAL_ACCESS);
        var continuation=secureTokenService.generate();
        tokens.save(new ApplicationToken(app.getId(),ApplicationTokenType.PORTAL_ACCESS,continuation.tokenHash(),now.plus(properties.getPortalLinkTtl()),now));
        return new AccessApplicationModels.VerificationResult(continuation.rawToken());
    }

    @Transactional
    public void requestAccessLink(String email,String ip,String userAgent){
        String normalized;
        try{normalized=emailNormalizer.normalize(email);}catch(RuntimeException ex){return;}
        var app=applications.findFirstByNormalizedEmailAndStatusNotIn(normalized,TERMINAL).orElse(null);
        if(app!=null && app.getEmailVerifiedAt()!=null) sendAccessLink(app,ip,userAgent);
    }

    @Transactional
    public void resendVerification(String rawToken,String ip,String userAgent){
        var token=findStoredToken(rawToken,ApplicationTokenType.EMAIL_VERIFICATION);
        var app=applications.findById(token.getApplicationId()).orElseThrow(AccessApplicationException::invalidToken);
        if(app.getEmailVerifiedAt()!=null) throw AccessApplicationException.verificationAlreadyUsed();
        if(TERMINAL.contains(app.getStatus())) throw AccessApplicationException.invalidToken();
        sendVerification(app,ip,userAgent);
    }

    @Transactional
    public ApplicantSessionService.IssuedApplicantSession establishSession(String rawToken,String ip,String userAgent){
        var now=clock.instant();
        var token=usableToken(rawToken,ApplicationTokenType.PORTAL_ACCESS,now);
        var application=applications.findById(token.getApplicationId()).orElseThrow(AccessApplicationException::invalidToken);
        if(application.getEmailVerifiedAt()==null) throw AccessApplicationException.invalidToken();
        if(TERMINAL.contains(application.getStatus())) throw AccessApplicationException.invalidToken();
        token.consume(now);
        var issued=sessions.issue(token.getApplicationId(),userAgent,ip);
        events.save(new ApplicationEvent(token.getApplicationId(),ApplicationEventType.SESSION_ESTABLISHED,"Secure applicant portal access established.",now));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_SESSION_ESTABLISHED,AuthAuditOutcome.SUCCESS,ip,userAgent,token.getApplicationId().toString(),"portal-session");
        return issued;
    }

    @Transactional(readOnly=true)
    public AccessApplicationModels.ApplicationView get(UUID applicationId){return view(applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid));}

    @Transactional
    public AccessApplicationModels.ApplicationView update(UUID applicationId,AccessApplicationModels.UpdateRequest r){
        var app=applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid); if(!app.isEditable())throw AccessApplicationException.notEditable();
        app.updateCommon(trim(r.firstName()),trim(r.lastName()),trim(r.phone()),trim(r.countryCode()),clock.instant());
        if(app.getApplicationType()==ApplicationType.DOCTOR){
            var d=doctorDetails.findById(applicationId).orElseThrow();
            if(r.yearsExperience()!=null && (r.yearsExperience()<0 || r.yearsExperience()>80))
                throw AccessApplicationException.validation("Years of experience must be between 0 and 80.");
            d.update(trim(r.professionalTitle()),trim(r.specialization()),r.yearsExperience(),trim(r.currentOrganization()),trim(r.currentPosition()),trim(r.professionalProfileUrl()),trim(r.registrationJurisdiction()),trim(r.registrationAuthority()),trim(r.registrationNumber()),trim(r.registrationType()),r.registrationIssuedAt(),r.registrationValidUntil());
            if(r.qualifications()!=null){
                qualifications.deleteAllByApplicationId(applicationId);
                for(var q:r.qualifications()){
                    if(q.completionYear()==null || q.completionYear()<1900 || q.completionYear()>2200)
                        throw AccessApplicationException.validation("Enter a valid completion year for each qualification.");
                    qualifications.save(new DoctorQualification(applicationId,require(q.qualificationName(),"Qualification name is required."),require(q.institution(),"Qualification institution is required."),require(q.countryCode(),"Qualification country is required."),q.completionYear()));
                }
            }
        } else {
            var d=researcherDetails.findById(applicationId).orElseThrow();
            d.update(trim(r.institution()),trim(r.department()),trim(r.professionalTitle()),trim(r.institutionalProfileUrl()),trim(r.researchField()),trim(r.researchPurpose()),trim(r.researchSummary()),trim(r.orcid()),trim(r.researchProfileUrl()),trim(r.publicationProfileUrl()),trim(r.ethicsReference()),trim(r.projectApprovalReference()));
        }
        events.save(new ApplicationEvent(applicationId,ApplicationEventType.PROFILE_UPDATED,"Application information updated.",clock.instant()));
        return view(app);
    }

    @Transactional
    public AccessApplicationModels.ApplicationView submit(UUID applicationId,boolean confirmedAccurate,String ip,String userAgent){
        var app=applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid); if(!app.isEditable())throw AccessApplicationException.notEditable(); if(!confirmedAccurate)throw AccessApplicationException.validation("Confirm that the submitted information is accurate before submitting.");
        if(app.getEmailVerifiedAt()==null)throw AccessApplicationException.validation("Verify the application email before submitting.");
        validateCommon(app);
        if(app.getApplicationType()==ApplicationType.DOCTOR) validateDoctor(app); else validateResearcher(app);
        app.submit(clock.instant()); events.save(new ApplicationEvent(applicationId,ApplicationEventType.SUBMITTED,"Application submitted for professional access review.",clock.instant())); mail.sendSubmitted(app.getEmail(),app.getFirstName()); audit.record(null,AuthAuditAction.ACCESS_APPLICATION_SUBMITTED,AuthAuditOutcome.SUCCESS,ip,userAgent,applicationId.toString(),"type="+app.getApplicationType()); return view(app);
    }

    @Transactional
    public AccessApplicationModels.ApplicationView withdraw(UUID applicationId,String ip,String userAgent){
        var app=applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid);
        if(!(app.getStatus()==ApplicationStatus.SUBMITTED||app.getStatus()==ApplicationStatus.MORE_INFO_REQUIRED))throw AccessApplicationException.notEditable();
        app.withdraw(clock.instant()); events.save(new ApplicationEvent(applicationId,ApplicationEventType.WITHDRAWN,"Application withdrawn by the applicant.",clock.instant())); mail.sendWithdrawn(app.getEmail(),app.getFirstName()); audit.record(null,AuthAuditAction.ACCESS_APPLICATION_WITHDRAWN,AuthAuditOutcome.SUCCESS,ip,userAgent,applicationId.toString(),"type="+app.getApplicationType()); return view(app);
    }

    @Transactional(readOnly=true)
    public List<AccessApplicationModels.EventView> events(UUID applicationId){return events.findAllByApplicationIdOrderByCreatedAtDesc(applicationId).stream().filter(e->isApplicantFacing(e.getEventType())).map(e->new AccessApplicationModels.EventView(e.getEventType().name(),e.getPublicMessage(),e.getCreatedAt())).toList();}

    private void sendResumeOrVerification(AccessApplication app,String ip,String userAgent){
        if(app.getEmailVerifiedAt()==null){
            sendVerification(app,ip,userAgent);
            return;
        }
        sendAccessLink(app,ip,userAgent);
    }

    private void sendVerification(AccessApplication app,String ip,String userAgent){
        var now=clock.instant();
        tokens.deleteAllByApplicationIdAndTokenType(app.getId(),ApplicationTokenType.EMAIL_VERIFICATION);
        var token=secureTokenService.generate();
        tokens.save(new ApplicationToken(app.getId(),ApplicationTokenType.EMAIL_VERIFICATION,token.tokenHash(),now.plus(properties.getEmailVerificationTtl()),now));
        mail.sendVerification(app.getEmail(),app.getFirstName(),token.rawToken());
        events.save(new ApplicationEvent(app.getId(),ApplicationEventType.EMAIL_VERIFICATION_SENT,"Application email verification sent.",now));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_VERIFICATION_SENT,AuthAuditOutcome.SUCCESS,ip,userAgent,app.getId().toString(),"type="+app.getApplicationType());
    }
    private void sendAccessLink(AccessApplication app,String ip,String userAgent){
        var now=clock.instant();
        tokens.deleteAllByApplicationIdAndTokenType(app.getId(),ApplicationTokenType.PORTAL_ACCESS);
        var token=secureTokenService.generate();
        tokens.save(new ApplicationToken(app.getId(),ApplicationTokenType.PORTAL_ACCESS,token.tokenHash(),now.plus(properties.getPortalLinkTtl()),now));
        mail.sendAccessLink(app.getEmail(),app.getFirstName(),token.rawToken());
        events.save(new ApplicationEvent(app.getId(),ApplicationEventType.ACCESS_LINK_REQUESTED,"A secure resume link was requested.",now));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_ACCESS_LINK_REQUESTED,AuthAuditOutcome.SUCCESS,ip,userAgent,app.getId().toString(),"type="+app.getApplicationType());
    }
    private boolean isApplicantFacing(ApplicationEventType type){return type==ApplicationEventType.APPLICATION_CREATED||type==ApplicationEventType.EMAIL_VERIFIED||type==ApplicationEventType.DOCUMENT_UPLOADED||type==ApplicationEventType.SUBMITTED||type==ApplicationEventType.WITHDRAWN||type==ApplicationEventType.REVIEW_STARTED||type==ApplicationEventType.MORE_INFO_REQUESTED;}
    private ApplicationToken verificationToken(String raw,java.time.Instant now){
        var token=findStoredToken(raw,ApplicationTokenType.EMAIL_VERIFICATION);
        if(token.usableAt(now)) return token;
        var app=applications.findById(token.getApplicationId()).orElseThrow(AccessApplicationException::invalidToken);
        if(app.getEmailVerifiedAt()!=null) throw AccessApplicationException.verificationAlreadyUsed();
        throw AccessApplicationException.verificationExpired();
    }
    private ApplicationToken findStoredToken(String raw,ApplicationTokenType type){if(raw==null||raw.isBlank())throw AccessApplicationException.invalidToken();return tokens.findByTokenHashAndTokenType(secureTokenService.hash(raw),type).orElseThrow(AccessApplicationException::invalidToken);}
    private ApplicationToken usableToken(String raw,ApplicationTokenType type,java.time.Instant now){if(raw==null||raw.isBlank())throw AccessApplicationException.invalidToken();var token=tokens.findByTokenHashAndTokenType(secureTokenService.hash(raw),type).orElseThrow(AccessApplicationException::invalidToken);if(!token.usableAt(now))throw AccessApplicationException.invalidToken();return token;}
    private void validateCommon(AccessApplication app){
        if(blank(app.getFirstName())||blank(app.getLastName())||blank(app.getPhone())||blank(app.getCountryCode()))
            throw AccessApplicationException.validation("Complete the required identity and contact information.");
    }
    private void validateDoctor(AccessApplication app){
        var d=doctorDetails.findById(app.getId()).orElseThrow();
        if(blank(d.getProfessionalTitle())||blank(d.getSpecialization())||d.getYearsExperience()==null||blank(d.getCurrentOrganization())||blank(d.getCurrentPosition())||blank(d.getRegistrationJurisdiction())||blank(d.getRegistrationAuthority())||blank(d.getRegistrationNumber()))throw AccessApplicationException.validation("Complete the required professional and registration information.");
        if(qualifications.countByApplicationId(app.getId())<1)throw AccessApplicationException.validation("Add at least one structured qualification.");
        if(documents.countByApplicationIdAndDocumentType(app.getId(),ApplicationDocumentType.CV)<1)throw AccessApplicationException.validation("A CV is required.");
        if(documents.countByApplicationIdAndDocumentType(app.getId(),ApplicationDocumentType.MEDICAL_LICENSE)<1)throw AccessApplicationException.validation("Medical registration evidence is required.");
        if(documents.countByApplicationIdAndDocumentType(app.getId(),ApplicationDocumentType.QUALIFICATION)<1)throw AccessApplicationException.validation("At least one qualification document is required.");
    }
    private void validateResearcher(AccessApplication app){var d=researcherDetails.findById(app.getId()).orElseThrow();if(blank(d.getInstitution())||blank(d.getProfessionalTitle())||blank(d.getResearchField())||blank(d.getResearchPurpose()))throw AccessApplicationException.validation("Complete the required institution, professional role, research field, and research purpose information.");}
    private AccessApplicationModels.ApplicationView view(AccessApplication app){
        var docs=documents.findAllByApplicationIdOrderByCreatedAt(app.getId()).stream().map(d->new AccessApplicationModels.DocumentView(d.getId(),d.getDocumentType(),d.getOriginalFilename(),d.getMimeType(),d.getSizeBytes(),d.getCreatedAt())).toList();
        if(app.getApplicationType()==ApplicationType.DOCTOR){var d=doctorDetails.findById(app.getId()).orElseThrow();var qs=qualifications.findAllByApplicationIdOrderById(app.getId()).stream().map(q->new AccessApplicationModels.QualificationView(q.getId(),q.getQualificationName(),q.getInstitution(),q.getCountryCode(),q.getCompletionYear())).toList();return new AccessApplicationModels.ApplicationView(app.getId(),app.getApplicationType(),app.getFirstName(),app.getLastName(),app.getEmail(),app.getPhone(),app.getCountryCode(),app.getStatus(),app.getEmailVerifiedAt(),app.getSubmittedAt(),new AccessApplicationModels.DoctorDetailView(d.getProfessionalTitle(),d.getSpecialization(),d.getYearsExperience(),d.getCurrentOrganization(),d.getCurrentPosition(),d.getProfessionalProfileUrl(),d.getRegistrationJurisdiction(),d.getRegistrationAuthority(),d.getRegistrationNumber(),d.getRegistrationType(),d.getRegistrationIssuedAt(),d.getRegistrationValidUntil()),null,qs,docs);}
        var r=researcherDetails.findById(app.getId()).orElseThrow();return new AccessApplicationModels.ApplicationView(app.getId(),app.getApplicationType(),app.getFirstName(),app.getLastName(),app.getEmail(),app.getPhone(),app.getCountryCode(),app.getStatus(),app.getEmailVerifiedAt(),app.getSubmittedAt(),null,new AccessApplicationModels.ResearcherDetailView(r.getInstitution(),r.getDepartment(),r.getProfessionalTitle(),r.getInstitutionalProfileUrl(),r.getResearchField(),r.getResearchPurpose(),r.getResearchSummary(),r.getOrcid(),r.getResearchProfileUrl(),r.getPublicationProfileUrl(),r.getEthicsReference(),r.getProjectApprovalReference()),List.of(),docs);
    }
    private String require(String value,String message){String v=trim(value);if(blank(v))throw AccessApplicationException.validation(message);return v;}
    private String trim(String v){return v==null?null:v.trim();} private boolean blank(String v){return v==null||v.isBlank();}
}
