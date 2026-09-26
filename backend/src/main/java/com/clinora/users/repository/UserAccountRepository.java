package com.clinora.users.repository;

import com.clinora.users.domain.AccountStatus;
import com.clinora.users.domain.UserAccount;
import com.clinora.users.domain.UserRole;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByNormalizedEmail(String normalizedEmail);

    boolean existsByNormalizedEmail(String normalizedEmail);

    boolean existsByRole(UserRole role);

    /**
     * Researcher directory search — returns only active, approved RESEARCHER accounts.
     * Search is case-insensitive and matches against firstName or lastName.
     * Excludes the calling user, existing active project members, and pending invitees.
     */
    @Query("""
            SELECT u FROM UserAccount u
            WHERE u.role = :role
              AND u.accountStatus = :status
              AND (
                  LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :q, '%'))
              )
            ORDER BY u.firstName ASC, u.lastName ASC
            """)
    List<UserAccount> searchResearchers(
            @Param("q") String query,
            @Param("role") UserRole role,
            @Param("status") AccountStatus status,
            Pageable pageable
    );
}

