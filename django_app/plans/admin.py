from django.contrib import admin
from .models import TravelPlan, PlanDetail, PlanDetailImage, PlanLike, PlanComment

admin.site.register(TravelPlan)
admin.site.register(PlanDetail)
admin.site.register(PlanDetailImage)
admin.site.register(PlanLike)
admin.site.register(PlanComment)