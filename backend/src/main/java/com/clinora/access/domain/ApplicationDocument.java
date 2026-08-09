package com.clinora.access.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="application_documents")
public class ApplicationDocument {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @Column(name="application_id",nullable=false) private UUID applicationId;
    @Enumerated(EnumType.STRING) @Column(name="document_type",nullable=false,length=48) private ApplicationDocumentType documentType;
    @Column(name="object_key",nullable=false,unique=true,length=700) private String objectKey;
    @Column(name="original_filename",nullable=false,length=255) private String originalFilename;
    @Column(name="mime_type",nullable=false,length=120) private String mimeType;
    @Column(name="size_bytes",nullable=false) private long sizeBytes;
    @Column(name="sha256_checksum",nullable=false,length=64) private String sha256Checksum;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected ApplicationDocument(){}
    public ApplicationDocument(UUID applicationId,ApplicationDocumentType documentType,String objectKey,String originalFilename,String mimeType,long sizeBytes,String sha256Checksum,Instant createdAt){this.applicationId=applicationId;this.documentType=documentType;this.objectKey=objectKey;this.originalFilename=originalFilename;this.mimeType=mimeType;this.sizeBytes=sizeBytes;this.sha256Checksum=sha256Checksum;this.createdAt=createdAt;}
    public UUID getId(){return id;} public UUID getApplicationId(){return applicationId;} public ApplicationDocumentType getDocumentType(){return documentType;} public String getObjectKey(){return objectKey;} public String getOriginalFilename(){return originalFilename;} public String getMimeType(){return mimeType;} public long getSizeBytes(){return sizeBytes;} public String getSha256Checksum(){return sha256Checksum;} public Instant getCreatedAt(){return createdAt;}
}
