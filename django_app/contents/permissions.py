from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    작성자(owner)만 수정/삭제 권한을 가짐.
    그 외 사용자는 읽기(GET, HEAD, OPTIONS)만 가능.
    """

    def has_object_permission(self, request, view, obj):
        # 읽기 권한은 모두에게 허용 (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True

        # 쓰기 권한은 객체의 소유자(user)에게만 허용
        # 모델에 'user' 필드가 있어야 함
        return obj.user == request.user
