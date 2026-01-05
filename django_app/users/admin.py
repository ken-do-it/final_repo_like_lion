from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserPreference, LocalBadge

# 커스텀 유저 모델은 UserAdmin을 써야 비밀번호 관리 등이 편합니다.
admin.site.register(User, UserAdmin)
admin.site.register(UserPreference)
admin.site.register(LocalBadge)