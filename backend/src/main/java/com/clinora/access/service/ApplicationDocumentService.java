package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.*;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ApplicationDocumentService {
    private static final Set<String> ALLOWED_MIME=Set.of("application/pdf","image/jpeg","image/png");
    private final AccessApplicationRepository applications;
    private final ApplicationDocumentRepository documents;
    private final ApplicationEventRepository events;
    private final ApplicationDocumentStoragePort storage;
    private final AccessApplicationProperties properties;
    private final AuthAuditService audit;
    private final Clock clock;

    public ApplicationDocumentService(AccessApplicationRepository applications,ApplicationDocumentRepository documents,ApplicationEventRepository events,ApplicationDocumentStoragePort storage,AccessApplicationProperties properties,AuthAuditService audit,Clock clock){this.applications=applications;this.documents=documents;this.events=events;this.storage=storage;this.properties=properties;this.audit=audit;this.clock=clock;}

    @Transactional
    public AccessApplicationModels.DocumentView upload(UUID applicationId,ApplicationDocumentType type,MultipartFile file,String ip,String userAgent) {
        AccessApplication app=applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid);
        if(!app.isEditable()) throw AccessApplicationException.notEditable();
        validateType(app.getApplicationType(),type);
        byte[] bytes;
        try { bytes=file.getBytes(); } catch(Exception ex){throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_READ_FAILED","The document could not be read.");}
        if(bytes.length==0 || bytes.length>properties.getMaxDocumentSize().toBytes()) throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_SIZE_INVALID","The document is empty or exceeds the configured upload limit.");
        String detected=detectMime(bytes);
        if(!ALLOWED_MIME.contains(detected)) throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_TYPE_INVALID","Only PDF, JPEG, and PNG documents are accepted.");
        String supplied=file.getContentType();
        if(supplied!=null && !supplied.isBlank() && !compatible(supplied,detected)) throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_TYPE_INVALID","The document content does not match its declared type.");
        String filename=safeFilename(file.getOriginalFilename());
        if(!extensionCompatible(filename,detected)) throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_EXTENSION_INVALID","The filename extension does not match the document content.");
        String key="applications/"+applicationId+"/"+UUID.randomUUID()+extensionFor(detected);
        String checksum=sha256(bytes);
        storage.put(key,bytes,detected);
        ApplicationDocument entity;
        try {
            entity=documents.save(new ApplicationDocument(applicationId,type,key,filename,detected,bytes.length,checksum,clock.instant()));
        } catch(RuntimeException exception) {
            storage.delete(key);
            throw exception;
        }
        events.save(new ApplicationEvent(applicationId,ApplicationEventType.DOCUMENT_UPLOADED,"A supporting document was uploaded.",clock.instant()));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_DOCUMENT_UPLOADED,AuthAuditOutcome.SUCCESS,ip,userAgent,applicationId.toString(),"type="+type);
        return view(entity);
    }

    @Transactional(readOnly=true)
    public Download download(UUID applicationId,UUID documentId){var doc=documents.findByIdAndApplicationId(documentId,applicationId).orElseThrow(AccessApplicationException::sessionInvalid);var stored=storage.get(doc.getObjectKey());return new Download(doc.getOriginalFilename(),stored.contentType(),stored.bytes());}

    @Transactional(readOnly=true)
    public Download downloadForAdmin(UUID applicationId,UUID documentId,UUID reviewerUserId,String ip,String userAgent){var doc=documents.findByIdAndApplicationId(documentId,applicationId).orElseThrow(AccessApplicationException::documentNotFound);var stored=storage.get(doc.getObjectKey());audit.record(reviewerUserId,AuthAuditAction.ACCESS_APPLICATION_DOCUMENT_VIEWED,AuthAuditOutcome.SUCCESS,ip,userAgent,applicationId.toString(),"documentId="+documentId+";type="+doc.getDocumentType());return new Download(doc.getOriginalFilename(),stored.contentType(),stored.bytes());}

    @Transactional
    public void delete(UUID applicationId,UUID documentId,String ip,String userAgent){
        AccessApplication app=applications.findById(applicationId).orElseThrow(AccessApplicationException::sessionInvalid); if(!app.isEditable())throw AccessApplicationException.notEditable();
        var doc=documents.findByIdAndApplicationId(documentId,applicationId).orElseThrow(AccessApplicationException::sessionInvalid);
        storage.delete(doc.getObjectKey()); documents.delete(doc); events.save(new ApplicationEvent(applicationId,ApplicationEventType.DOCUMENT_DELETED,"A supporting document was removed.",clock.instant()));
        audit.record(null,AuthAuditAction.ACCESS_APPLICATION_DOCUMENT_DELETED,AuthAuditOutcome.SUCCESS,ip,userAgent,applicationId.toString(),"type="+doc.getDocumentType());
    }

    public AccessApplicationModels.DocumentView view(ApplicationDocument d){return new AccessApplicationModels.DocumentView(d.getId(),d.getDocumentType(),d.getOriginalFilename(),d.getMimeType(),d.getSizeBytes(),d.getCreatedAt());}
    private void validateType(ApplicationType appType,ApplicationDocumentType type){
        boolean ok=appType==ApplicationType.DOCTOR ? Set.of(ApplicationDocumentType.CV,ApplicationDocumentType.MEDICAL_LICENSE,ApplicationDocumentType.QUALIFICATION,ApplicationDocumentType.OTHER).contains(type) : Set.of(ApplicationDocumentType.CV,ApplicationDocumentType.INSTITUTIONAL_EVIDENCE,ApplicationDocumentType.ETHICS_OR_PROJECT_APPROVAL,ApplicationDocumentType.OTHER).contains(type);
        if(!ok)throw new AccessApplicationException(HttpStatus.BAD_REQUEST,"DOCUMENT_TYPE_NOT_ALLOWED","That document type is not valid for this application.");
    }
    private String detectMime(byte[] b){if(b.length>=5&&b[0]=='%'&&b[1]=='P'&&b[2]=='D'&&b[3]=='F'&&b[4]=='-')return "application/pdf";if(b.length>=3&&(b[0]&255)==0xff&&(b[1]&255)==0xd8&&(b[2]&255)==0xff)return "image/jpeg";if(b.length>=8&&(b[0]&255)==0x89&&b[1]=='P'&&b[2]=='N'&&b[3]=='G'&&(b[4]&255)==0x0d&&(b[5]&255)==0x0a&&(b[6]&255)==0x1a&&(b[7]&255)==0x0a)return "image/png";return "application/octet-stream";}
    private boolean compatible(String supplied,String detected){return supplied.equalsIgnoreCase(detected)||(detected.equals("image/jpeg")&&(supplied.equalsIgnoreCase("image/jpg")||supplied.equalsIgnoreCase("image/jpeg")));}
    private boolean extensionCompatible(String filename,String detected){String lower=filename.toLowerCase(java.util.Locale.ROOT);return switch(detected){case "application/pdf"->lower.endsWith(".pdf");case "image/jpeg"->lower.endsWith(".jpg")||lower.endsWith(".jpeg");case "image/png"->lower.endsWith(".png");default->false;};}
    private String extensionFor(String mime){return switch(mime){case "application/pdf"->".pdf";case "image/jpeg"->".jpg";case "image/png"->".png";default->"";};}
    private String safeFilename(String value){if(value==null||value.isBlank())return "document";String name=value.replace('\\','/');name=name.substring(name.lastIndexOf('/')+1).replaceAll("[\\r\\n]","");return name.substring(0,Math.min(255,name.length()));}
    private String sha256(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(NoSuchAlgorithmException ex){throw new IllegalStateException(ex);}}
    public record Download(String filename,String contentType,byte[] bytes){}
}
