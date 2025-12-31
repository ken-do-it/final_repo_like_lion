from django.contrib import admin
from .models import Place, PlaceReview, PlaceBookmark, LocalColumn, LocalColumnSection, LocalColumnSectionImage

admin.site.register(Place)
admin.site.register(PlaceReview)
admin.site.register(PlaceBookmark)
class LocalColumnSectionInline(admin.StackedInline):
    model = LocalColumnSection
    extra = 0

@admin.register(LocalColumn)
class LocalColumnAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'view_count', 'created_at')
    inlines = [LocalColumnSectionInline] # 칼럼 상세에서 섹션도 같이 관리 가능

admin.site.register(LocalColumnSection)
admin.site.register(LocalColumnSectionImage)