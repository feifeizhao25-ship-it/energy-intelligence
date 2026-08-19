#!/bin/bash
# ============================================
# 新能源智库部署脚本
# Phase 6 Week 10
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
REGISTRY="ghcr.io/energy-intelligence"
NAMESPACE="energy-intelligence"

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    command -v docker >/dev/null 2>&1 || { log_error "Docker未安装"; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl未安装"; exit 1; }
    
    # 检查kubectl连接
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "无法连接到Kubernetes集群"
        exit 1
    fi
    
    log_info "依赖检查通过"
}

# 构建镜像
build_images() {
    log_info "构建Docker镜像..."
    
    # 构建API镜像
    log_info "构建API镜像..."
    docker build -t ${REGISTRY}/api:${VERSION} -f apps/api/Dockerfile apps/api/
    
    # 构建Web-CN镜像
    log_info "构建Web-CN镜像..."
    docker build -t ${REGISTRY}/web-cn:${VERSION} -f frontend-cn-web/Dockerfile frontend-cn-web/
    
    # 构建Web-Global镜像
    log_info "构建Web-Global镜像..."
    docker build -t ${REGISTRY}/web-global:${VERSION} -f web-global/Dockerfile web-global/
    
    log_info "镜像构建完成"
}

# 推送镜像
push_images() {
    log_info "推送Docker镜像..."
    
    docker push ${REGISTRY}/api:${VERSION}
    docker push ${REGISTRY}/web-cn:${VERSION}
    docker push ${REGISTRY}/web-global:${VERSION}
    
    log_info "镜像推送完成"
}

# 数据库迁移
run_migrations() {
    log_info "执行数据库迁移..."
    
    # 创建迁移Job
    kubectl create job db-migrate-${VERSION} \
        --from=cronjob/db-migrate \
        -n ${NAMESPACE} \
        --dry-run=client -o yaml | \
        kubectl apply -f -
    
    # 等待迁移完成
    kubectl wait --for=condition=complete job/db-migrate-${VERSION} \
        -n ${NAMESPACE} \
        --timeout=300s
    
    log_info "数据库迁移完成"
}

# 部署到Kubernetes
deploy_k8s() {
    log_info "部署到Kubernetes..."
    
    # 更新镜像
    kubectl set image deployment/api \
        api=${REGISTRY}/api:${VERSION} \
        -n ${NAMESPACE}
    
    kubectl set image deployment/web-cn \
        web-cn=${REGISTRY}/web-cn:${VERSION} \
        -n ${NAMESPACE}
    
    kubectl set image deployment/web-global \
        web-global=${REGISTRY}/web-global:${VERSION} \
        -n ${NAMESPACE}
    
    # 等待部署完成
    log_info "等待部署完成..."
    kubectl rollout status deployment/api -n ${NAMESPACE} --timeout=300s
    kubectl rollout status deployment/web-cn -n ${NAMESPACE} --timeout=300s
    kubectl rollout status deployment/web-global -n ${NAMESPACE} --timeout=300s
    
    log_info "部署完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 获取服务URL
    API_URL=$(kubectl get svc api -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    # 检查API健康
    if curl -sf http://${API_URL}/health >/dev/null 2>&1; then
        log_info "API健康检查通过"
    else
        log_error "API健康检查失败"
        return 1
    fi
    
    # 检查就绪状态
    if curl -sf http://${API_URL}/ready >/dev/null 2>&1; then
        log_info "API就绪检查通过"
    else
        log_error "API就绪检查失败"
        return 1
    fi
    
    log_info "健康检查通过"
}

# 回滚
rollback() {
    log_warn "执行回滚..."
    
    kubectl rollout undo deployment/api -n ${NAMESPACE}
    kubectl rollout undo deployment/web-cn -n ${NAMESPACE}
    kubectl rollout undo deployment/web-global -n ${NAMESPACE}
    
    # 等待回滚完成
    kubectl rollout status deployment/api -n ${NAMESPACE} --timeout=300s
    kubectl rollout status deployment/web-cn -n ${NAMESPACE} --timeout=300s
    kubectl rollout status deployment/web-global -n ${NAMESPACE} --timeout=300s
    
    log_info "回滚完成"
}

# 主函数
main() {
    log_info "开始部署 - 环境: ${ENVIRONMENT}, 版本: ${VERSION}"
    
    check_dependencies
    
    case ${ENVIRONMENT} in
        staging)
            build_images
            push_images
            deploy_k8s
            health_check || rollback
            ;;
        production)
            log_info "生产环境部署需要手动确认"
            read -p "确认部署到生产环境? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                log_info "取消部署"
                exit 0
            fi
            run_migrations
            deploy_k8s
            health_check || rollback
            ;;
        *)
            log_error "未知环境: ${ENVIRONMENT}"
            exit 1
            ;;
    esac
    
    log_info "部署流程完成"
}

# 错误处理
trap 'log_error "部署失败"; exit 1' ERR

# 运行主函数
main "$@"
