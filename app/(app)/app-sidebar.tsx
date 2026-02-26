"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type SVGProps, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import CardBody from "react-bootstrap/CardBody";
import Modal from "react-bootstrap/Modal";
import Nav from "react-bootstrap/Nav";
import NavLink from "react-bootstrap/NavLink";
import ConfirmationModal from "@/app/components/confirmation-modal";
import { ACTIVE_FINANCE_ENTITY_STORAGE_KEY } from "@/lib/finance/constants";

type IconProps = SVGProps<SVGSVGElement>;
type EntityType = "PERSONAL" | "BUSINESS";

type SidebarEntity = {
    id: string;
    name: string;
    type: EntityType;
};

type AppSidebarProps = {
    entities: SidebarEntity[];
    activeEntityId: string;
    setActiveEntityAction: (entityId: string) => Promise<void>;
    createEntityAction: (name: string, type: EntityType) => Promise<void>;
    updateEntityAction: (entityId: string, name: string, type: EntityType) => Promise<void>;
    deleteEntityAction: (entityId: string) => Promise<void>;
};

const WalletIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M16.5 10.5h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
        <circle cx="16.75" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
);

const DashboardIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
);

const TransactionsIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M3 7h18" />
        <path d="M3 12h18" />
        <path d="M3 17h18" />
        <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
);

const IncomeIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M12 20V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 20h16" />
    </svg>
);

const InvestmentIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M4 19.5h16" />
        <path d="m6.5 15 4-4 3 3 4.5-6" />
        <path d="M18 8h2v2" />
    </svg>
);

const BudgetIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M7 9h10" />
        <path d="M7 13h7" />
        <path d="M7 17h5" />
    </svg>
);

const LoanIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M4 8h12a4 4 0 1 1 0 8H4" />
        <path d="m8 4-4 4 4 4" />
        <path d="m16 20 4-4-4-4" />
    </svg>
);

const CreditIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M3 10h18" />
        <path d="M7 14h4" />
    </svg>
);

const CalendarIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M8 3v3" />
        <path d="M16 3v3" />
        <path d="M3 9.5h18" />
        <path d="M8 13h3" />
        <path d="M13 13h3" />
        <path d="M8 17h3" />
    </svg>
);

const LogoutIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
        <path d="M14 16.5 18.5 12 14 7.5" />
        <path d="M9.5 12h9" />
    </svg>
);

const SidebarToggleIcon = ({ isCollapsed, ...props }: IconProps & { isCollapsed: boolean }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M8.5 6.5v11" />
        {isCollapsed ? <path d="m13 9 3 3-3 3" /> : <path d="m16 9-3 3 3 3" />}
    </svg>
);

const links = [
    { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
    { href: "/transactions", label: "Transactions", Icon: TransactionsIcon },
    { href: "/income", label: "Income", Icon: IncomeIcon },
    { href: "/investment", label: "Investment", Icon: InvestmentIcon },
    { href: "/budget", label: "Budget", Icon: BudgetIcon },
    { href: "/loan", label: "Loan", Icon: LoanIcon },
    { href: "/credit", label: "Credit", Icon: CreditIcon },
    { href: "/wallet", label: "Wallet", Icon: WalletIcon },
    { href: "/monthly-overview", label: "Monthly Overview", Icon: CalendarIcon },
];

const entityTypeLabel: Record<EntityType, string> = {
    PERSONAL: "Personal",
    BUSINESS: "Business",
};

export default function AppSidebar({
    entities,
    activeEntityId,
    setActiveEntityAction,
    createEntityAction,
    updateEntityAction,
    deleteEntityAction,
}: AppSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState(activeEntityId);
    const [isSwitchingEntity, setIsSwitchingEntity] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createType, setCreateType] = useState<EntityType>("PERSONAL");
    const [editName, setEditName] = useState("");
    const [editType, setEditType] = useState<EntityType>("PERSONAL");
    const [entityError, setEntityError] = useState<string | null>(null);
    const [isMutatingEntity, setIsMutatingEntity] = useState(false);

    useEffect(() => {
        setSelectedEntityId(activeEntityId);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(ACTIVE_FINANCE_ENTITY_STORAGE_KEY, activeEntityId);
        }
    }, [activeEntityId]);

    const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null;

    const handleEntityChange = async (entityId: string) => {
        if (!entityId || entityId === activeEntityId || isSwitchingEntity) {
            return;
        }

        const previousEntityId = selectedEntityId;
        setSelectedEntityId(entityId);
        setIsSwitchingEntity(true);

        try {
            await setActiveEntityAction(entityId);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(ACTIVE_FINANCE_ENTITY_STORAGE_KEY, entityId);
            }
            router.refresh();
        } catch {
            setSelectedEntityId(previousEntityId);
        } finally {
            setIsSwitchingEntity(false);
        }
    };

    const handleCreateEntity = async () => {
        if (isMutatingEntity) return;
        setEntityError(null);
        setIsMutatingEntity(true);
        try {
            await createEntityAction(createName, createType);
            setCreateName("");
            setCreateType("PERSONAL");
            setIsCreateOpen(false);
            router.refresh();
        } catch (error) {
            setEntityError(error instanceof Error ? error.message : "Could not create entity.");
        } finally {
            setIsMutatingEntity(false);
        }
    };

    const openEditModal = () => {
        if (!selectedEntity) {
            return;
        }
        setEntityError(null);
        setEditName(selectedEntity.name);
        setEditType(selectedEntity.type);
        setIsEditOpen(true);
    };

    const handleUpdateEntity = async () => {
        if (!selectedEntity || isMutatingEntity) return;
        setEntityError(null);
        setIsMutatingEntity(true);
        try {
            await updateEntityAction(selectedEntity.id, editName, editType);
            setIsEditOpen(false);
            router.refresh();
        } catch (error) {
            setEntityError(error instanceof Error ? error.message : "Could not update entity.");
        } finally {
            setIsMutatingEntity(false);
        }
    };

    const handleDeleteEntity = async () => {
        if (!selectedEntity || isMutatingEntity) return;
        setEntityError(null);
        setIsMutatingEntity(true);
        try {
            await deleteEntityAction(selectedEntity.id);
            setIsDeleteOpen(false);
            router.refresh();
        } catch (error) {
            setEntityError(error instanceof Error ? error.message : "Could not delete entity.");
        } finally {
            setIsMutatingEntity(false);
        }
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);

        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Redirect regardless so users do not get stuck in the protected shell.
        } finally {
            router.replace("/login");
        }
    };

    return (
        <Card as="aside" data-collapsed={isCollapsed} className="pf-surface-panel h-100 border-0">
            <CardBody className="d-flex flex-column p-3 p-sm-4">
                <div className="mb-3 mb-sm-4">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                        {!isCollapsed && (
                            <p className="m-0 text-uppercase small" style={{ letterSpacing: "0.3em", color: "var(--color-kicker-primary)" }}>
                                Personal Finance
                            </p>
                        )}
                        <Button
                            type="button"
                            variant="link"
                            className="d-inline-flex align-items-center justify-content-center p-0 text-decoration-none"
                            onClick={() => setIsCollapsed((value) => !value)}
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            style={{
                                width: "1.75rem",
                                height: "1.75rem",
                                color: "var(--color-text-secondary)",
                                border: 0,
                                background: "transparent",
                                boxShadow: "none",
                                transition: "color 160ms ease, opacity 160ms ease",
                            }}
                        >
                            <SidebarToggleIcon isCollapsed={isCollapsed} width={20} height={20} />
                        </Button>
                    </div>
                    {!isCollapsed && <h1 className="mt-2 mb-0 fs-4 fw-semibold" style={{ color: "var(--color-text-strong)" }}>Dashboard</h1>}
                </div>

                {!isCollapsed && (
                    <div className="mb-3">
                        <label htmlFor="sidebar-entity" className="form-label small fw-semibold mb-1">
                            Entity
                        </label>
                        <select
                            id="sidebar-entity"
                            className="form-control form-control-sm"
                            value={selectedEntityId}
                            onChange={(event) => handleEntityChange(event.target.value)}
                            disabled={entities.length === 0 || isSwitchingEntity}
                        >
                            {entities.map((entity) => (
                                <option key={entity.id} value={entity.id}>
                                    {entity.name} ({entityTypeLabel[entity.type]})
                                </option>
                            ))}
                        </select>
                        {isSwitchingEntity && (
                            <small className="d-block mt-1" style={{ color: "var(--color-text-muted)" }}>
                                Switching entity...
                            </small>
                        )}
                        <div className="d-flex flex-wrap gap-2 mt-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={() => {
                                    setEntityError(null);
                                    setCreateName("");
                                    setCreateType("PERSONAL");
                                    setIsCreateOpen(true);
                                }}
                            >
                                Add
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                onClick={openEditModal}
                                disabled={!selectedEntity}
                            >
                                Edit
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-danger"
                                onClick={() => setIsDeleteOpen(true)}
                                disabled={!selectedEntity}
                            >
                                Delete
                            </Button>
                        </div>
                        {entityError && (
                            <small className="d-block mt-2 text-danger">
                                {entityError}
                            </small>
                        )}
                    </div>
                )}

                <Nav className="flex-column gap-2 pb-1">
                    {links.map((link) => {
                        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

                        return (
                            <NavLink
                                key={link.href}
                                as={Link}
                                href={link.href}
                                className={`rounded-4 px-3 py-2 border d-flex align-items-center ${isCollapsed ? "justify-content-center" : "gap-2"}`}
                                style={isActive ? {
                                    background: "var(--color-primary)",
                                    borderColor: "transparent",
                                    color: "var(--color-primary-text)",
                                } : {
                                    borderColor: "var(--color-border-default)",
                                    color: "var(--color-text-subtle)",
                                }}
                                aria-label={isCollapsed ? link.label : undefined}
                                title={isCollapsed ? link.label : undefined}
                            >
                                <link.Icon width={16} height={16} />
                                {!isCollapsed && <span>{link.label}</span>}
                            </NavLink>
                        );
                    })}
                </Nav>

                <Button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    variant="outline-danger"
                    className={`mt-3 mt-sm-auto rounded-4 py-2 fw-semibold d-flex align-items-center ${isCollapsed ? "justify-content-center" : "gap-2"}`}
                    style={{ borderColor: "var(--color-logout-border)", color: "var(--color-logout-text)" }}
                    aria-label={isCollapsed ? "Logout" : undefined}
                    title={isCollapsed ? "Logout" : undefined}
                >
                    <LogoutIcon width={16} height={16} />
                    {!isCollapsed && (isLoggingOut ? "Logging out..." : "Logout")}
                </Button>
            </CardBody>

            <Modal show={isCreateOpen} onHide={() => setIsCreateOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Add Entity</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-grid gap-2">
                    <label className="small fw-semibold" htmlFor="entity-create-name">Name</label>
                    <input
                        id="entity-create-name"
                        className="form-control"
                        value={createName}
                        onChange={(event) => setCreateName(event.target.value)}
                        maxLength={80}
                        placeholder="Entity name"
                    />
                    <label className="small fw-semibold mt-2" htmlFor="entity-create-type">Type</label>
                    <select
                        id="entity-create-type"
                        className="form-control"
                        value={createType}
                        onChange={(event) => setCreateType(event.target.value as EntityType)}
                    >
                        <option value="PERSONAL">Personal</option>
                        <option value="BUSINESS">Business</option>
                    </select>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreateEntity} disabled={isMutatingEntity}>
                        {isMutatingEntity ? "Saving..." : "Create"}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={isEditOpen} onHide={() => setIsEditOpen(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Entity</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-grid gap-2">
                    <label className="small fw-semibold" htmlFor="entity-edit-name">Name</label>
                    <input
                        id="entity-edit-name"
                        className="form-control"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        maxLength={80}
                        placeholder="Entity name"
                    />
                    <label className="small fw-semibold mt-2" htmlFor="entity-edit-type">Type</label>
                    <select
                        id="entity-edit-type"
                        className="form-control"
                        value={editType}
                        onChange={(event) => setEditType(event.target.value as EntityType)}
                    >
                        <option value="PERSONAL">Personal</option>
                        <option value="BUSINESS">Business</option>
                    </select>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setIsEditOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpdateEntity} disabled={isMutatingEntity || !selectedEntity}>
                        {isMutatingEntity ? "Saving..." : "Save"}
                    </Button>
                </Modal.Footer>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteOpen}
                title="Delete Entity"
                message={selectedEntity
                    ? `Delete "${selectedEntity.name}"? Related financial records will be deleted by cascade.`
                    : "Delete selected entity?"}
                confirmLabel={isMutatingEntity ? "Deleting..." : "Delete"}
                onCancel={() => {
                    if (!isMutatingEntity) {
                        setIsDeleteOpen(false);
                    }
                }}
                onConfirm={handleDeleteEntity}
            />
        </Card>
    );
}
