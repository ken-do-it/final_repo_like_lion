from django.contrib import admin
from .models import TravelPlan, PlanDetail, TravelPost, Comment , PlanDetailImage

admin.site.register(TravelPlan)
admin.site.register(PlanDetail)
admin.site.register(TravelPost)
admin.site.register(Comment)
admin.site.register(PlanDetailImage)